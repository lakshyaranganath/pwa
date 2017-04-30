import React from 'react';
import Helmet from 'react-helmet';
import { renderToString } from 'react-dom/server';
import { match } from 'react-router';
import { Provider } from 'react-redux';
import { ReduxAsyncConnect, loadOnServer } from 'redux-connect';
import html from '../render/html';
import configureStore from '../../client/redux/configureStore';
import routes from '../../client/routes';

const PWA_SSR = process.env.PWA_SSR === 'true';

const serverRenderedChunks = async (req, res, renderProps) => {
  const route = renderProps.routes[renderProps.routes.length - 1];
  const store = configureStore();

  res.set('Content-Type', 'text/html');

  const earlyChunk = html.earlyChunk(route);
  res.write(earlyChunk);
  res.flush();

  if (PWA_SSR) await loadOnServer({ ...renderProps, store });

  const lateChunk = html.lateChunk(
    PWA_SSR ? renderToString(
      <Provider store={store} key="provider">
        <ReduxAsyncConnect {...renderProps} />
      </Provider>,
    ) : '',
    Helmet.renderStatic(),
    store.getState(),
    route,
    req.ip,
  );
  res.write(lateChunk);
  res.flush();

  res.end();
};

export default (req, res) => {
  match({
    routes,
    location: req.originalUrl,
  }, (error, redirectLocation, renderProps) => {
    if (error) {
      return res.status(500).send(error.message);
    } else if (redirectLocation) {
      return res.redirect(redirectLocation.pathname + redirectLocation.search);
    } else if (!renderProps) {
      return res.status(404).send('404: Not Found');
    }
    return serverRenderedChunks(req, res, renderProps);
  });
};
