/* eslint-env jest */
import { denormalize, normalize, schema } from '../';
import sampleData from './data';

// PRELIMINARY SETUP

// simpler schemas
export const bookSchema = new schema.Entity('books', {}, { idAttribute: 'uuid' });
export const quoteSchema = new schema.Entity('quotes', {}, { idAttribute: 'uuid' });
export const userSchema = new schema.Entity('users', {}, { idAttribute: 'login' });
export const emotionSchema = new schema.Entity('emotions', {}, { idAttribute: 'name' });
export const impressionSchema = new schema.Entity('impressions', {}, { idAttribute: 'uuid' });
export const postSchema = new schema.Entity('posts', {}, { idAttribute: 'uuid' });
export const shelfSchema = new schema.Entity('shelves', {}, { idAttribute: 'uuid' });

shelfSchema.define({
  creator: userSchema
});

postSchema.define({
  creator: userSchema,
  book: bookSchema
});

impressionSchema.define({
  book: bookSchema,
  creator: userSchema,
  emotions: new schema.Array(emotionSchema)
});

quoteSchema.define({
  book: bookSchema,
  creator: userSchema
});

// more complex schema with array of polymorphic data
export const feedEntrySchema = new schema.Entity(
  'feedEntries',
  {},
  {
    idAttribute: (entry) => entryIdGenerator(entry)
  }
);

const resourcesSchema = new schema.Array({
  books: bookSchema,
  quotes: quoteSchema,
  impressions: impressionSchema,
  shelves: shelfSchema,
  posts: postSchema
}, (input, parent, key) => pluralizeResourceName(input.resourceType));

const activistsSchema = new schema.Array({
  shelves: shelfSchema,
  users: userSchema
}, (input, parent, key) => pluralizeResourceName(input.activistType));

feedEntrySchema.define({
  resources: resourcesSchema,
  activists: activistsSchema
});

export const feedEntriesSchema = new schema.Array(feedEntrySchema);

function entryIdGenerator(entry) {
  let time = entry.first_activity_at;
  if (typeof time === 'string') {
    time = new Date(time).getTime();
  }
  return `${entry.type}-${time}-${entry.resources[0].uuid}`;
}

function pluralizeResourceName(name) {
  if (name === 'shelf') {
    return 'shelves';
  } else {
    return `${name}s`;
  }
}

/*
* adjusts the api response in such a way that is easier to consume
* Array[Object] -> Array[Object]
*/
function prepareData(response) {
  return response
    .map((entity) => ({
      ...entity,
      entryType: getEntryType(entity),
      resources: addResourceType(entity.resources, getEntryType(entity)),
      activists: addActivistType(entity.activists, getEntryType(entity))
    }))
    .filter((entity) => (entity.entryType && entity.resources.length));
}

/*
* SOME HELPER FUNCTIONS
*/
function getEntryType(entity) {
  const { type, resources_type } = entity;

  if (type === 'start_reading' && resources_type === 'book') {
    return 'startReading';
  } else if (type === 'document_read' && resources_type === 'book') {
    return 'finishReading';
  } else if (type === 'marker' && resources_type === 'marker') {
    return 'quote';
  } else if (type === 'impression' && resources_type === 'impression') {
    return 'impression';
  } else if (type === 'bookshelf' && resources_type === 'bookshelf') {
    return 'shelf';
  } else if (type === 'post' && resources_type === 'post') {
    return 'post';
  }
}

function addResourceType(resources, entryType) {
  let resourceType;
  switch (entryType) {
    case 'startReading':
    case 'finishReading':
      resourceType = 'book';
      break;
    case 'quote':
    case 'impression':
    case 'shelf':
    case 'post':
      resourceType = entryType;
      break;
  }

  return resources.map((resource) => ({ ...resource, resourceType }));
}

function addActivistType(activists, entryType) {
  let activistType;
  switch (entryType) {
    case 'post':
      activistType = 'shelf';
      break;
    default:
      activistType = 'user';
      break;
  }
  return activists.map((activist) => ({ ...activist, activistType }));
}

describe.only('denormalize', () => {
  it('denormalizes my custom schemas', () => {
    const preparedData = prepareData(sampleData);
    const { result, entities } = normalize(preparedData, feedEntriesSchema);
    expect({ result, entities }).toMatchSnapshot();
    expect(denormalize(result, feedEntriesSchema, entities)).toEqual(preparedData);
  });
});
