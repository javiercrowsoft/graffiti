import { graphql } from 'graphql';
import {
  badRequest,
  methodNotAllowed
} from 'boom';
import {
  isGet,
  required,
  renderGraphiQL
} from '../util';

import pkg from '../../package.json';

function accepts({ headers }, type) {
  return headers.accept && headers.accept.includes(type);
}

const plugin = {
  register: (
    server,
    { graphiql = true, schema = required(),
      getSessionData = required(),
      authSettings = required() } = {},
    next) => {
    const handler = (request, reply) => {
      return getSessionData(request, reply, (err) => {
        if (err) return reply(err);

        const data = request.payload || request.query || {};
        const { query, variables } = data;

        if (accepts(request, 'html') && graphiql) {
          return reply(renderGraphiQL({ query, variables }));
        }

        if (query && query.includes('mutation') && isGet(request)) {
          return reply(methodNotAllowed('GraphQL mutation only allowed in POST request.'));
        }

        let parsedVariables = variables;
        try {
          parsedVariables = JSON.parse(variables);
        } catch (err) {
          // ignore
        }

        return graphql(schema, query, request, request, parsedVariables)
          .then((result) => {
            if (result.errors) {
              // const message = result.errors.map((error) => error.message).join('\n');
              // reply(badRequest(message));
              // return;
              result.errors = result.errors.map( (error) => {
                return {
                  message: error.message,
                  locations: error.locations
                }
              } );
            }

            reply(result);
          })
          .catch((err) => {
            reply(badRequest(err));
          });
      });
    };

    server.route({
      method: 'POST',
      path: '/graphql',
      config: {
        handler: handler,
        auth: authSettings // { mode: 'try', strategy: 'session' }
      }
    });

    if (graphiql) {
      server.route({
        method: 'GET',
        path: '/graphql',
        config: {
          handler: handler,
          auth: authSettings // { mode: 'try', strategy: 'session' }
        }
      });
    }

    next();
  }
};

plugin.register.attributes = { pkg };

export default plugin;
