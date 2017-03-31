/* eslint-env jest */
import { denormalize, normalize, schema } from '../';
import sampleData from './data';

// PRELIMINARY SETUP

// simpler schemas
export const bookSchema = new schema.Entity('books', {}, { idAttribute: 'uuid' });
export const userSchema = new schema.Entity('users', {}, { idAttribute: 'login' });
export const postSchema = new schema.Entity('posts', {}, { idAttribute: 'uuid' });

postSchema.define({
  creator: userSchema,
  book: bookSchema
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
  posts: postSchema
}, (input, parent, key) => pluralizeResourceName(input.resourceType));

feedEntrySchema.define({
  resources: resourcesSchema
});

export const feedEntriesSchema = new schema.Array(feedEntrySchema);

function entryIdGenerator(entry) {
  const time = entry.first_activity_at;
  return `${entry.type}-${time}-${entry.resources[0].uuid}`;
}

function pluralizeResourceName(name) {
  return `${name}s`;
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
      resources: addResourceType(entity.resources, getEntryType(entity))
    }))
    .filter((entity) => (entity.entryType && entity.resources.length));
}

/*
* SOME HELPER FUNCTIONS
*/
function getEntryType(entity) {
  const { type, resources_type } = entity;

  if (type === 'post' && resources_type === 'post') {
    return 'post';
  }
}

function addResourceType(resources, entryType) {
  return resources.map((resource) => ({ ...resource, resourceType: entryType }));
}

describe.only('denormalize', () => {
  it('denormalizes my custom schemas', () => {
    const preparedData = prepareData(sampleData);
    const { result, entities } = normalize(preparedData, feedEntriesSchema);
    expect({ result, entities }).toMatchSnapshot();
    expect(denormalize(result, feedEntriesSchema, entities)).toEqual(preparedData);
  });
});
