const joiql = require('../')
const { object, string, boolean } = require('joi')
const request = require('superagent')
const artsyXapp = require('artsy-xapp')
const growl = require('growl')
const { ARTSY_URL } = process.env

// Schemas
const Artist = object({
  id: string(),
  name: string(),
  location: string()
})
const Artwork = object({
  id: string(),
  title: string(),
  medium: string(),
  price: string(),
  artist: Artist.meta({
    args: { shallow: boolean() }
  })
})
const api = joiql({
  query: {
    artwork: Artwork.meta({
      args: { id: string().required().min(10) }
    }),
    artist: Artist.meta({
      args: { id: string().required() }
    })
  }
})

// JoiQL Middleware
const cache = {}
api.on('query', ({ req, res, state, end }) => {
  state.key = JSON.stringify(req)
  if (cache[state.key]) end(cache[state.key])
})
api.on('query.artwork', ({ req, res }) => {
  return request
    .get(`${ARTSY_URL}/api/v1/artwork/${req.args.id}`)
    .set('X-Xapp-Token', artsyXapp.token)
    .then(({ body }) => { res.artwork = body })
})
api.on('query.artwork.fields.artist', ({ req, res }) => {
  if (req.args.shallow !== false) return
  return request
    .get(`${ARTSY_URL}/api/v1/artist/${res.artwork.artist.id}`)
    .set('X-Xapp-Token', artsyXapp.token)
    .then(({ body }) => { res.artwork.artist = body })
})
api.on('query.artist', ({ req, res }) => {
  return request
    .get(`${ARTSY_URL}/api/v1/artist/${req.args.id}`)
    .set('X-Xapp-Token', artsyXapp.token)
    .then(({ body }) => { res.artist = body })
})
api.on('query.artwork.fields.price', () => {
  growl('Someone asked about price!')
})
api.on('query', ({ req, res, state }) => {
  cache[state.key] = res
  console.log('Returning...', Object.keys(res))
})

// Mount GraphQL into Express
const app = require('express')()
const graphqlHTTP = require('express-graphql')
app.use('/graphql', graphqlHTTP({
  schema: api.schema,
  graphiql: true
}))
artsyXapp.init(() => {
  app.listen(3000, () => console.log('listening on 3000'))
})
artsyXapp.on('error', console.log)
