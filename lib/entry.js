import path from 'path'
import React from 'react'
import { render, hydrate } from 'react-dom'
import {
  StaticRouter,
  BrowserRouter,
  Switch,
  Route,
  Link,
  withRouter
} from 'react-router-dom'
import minimatch from 'minimatch'

const IS_CLIENT = typeof document !== 'undefined'
const req = require.context(DIRNAME, true, /\.(js|mdx|jsx)$/)

const { filename, basename = '', disableScroll } = OPTIONS
const index = filename ? path.basename(filename, path.extname(filename)) : 'index'

const getComponents = req => req.keys()
  .filter(key => minimatch(key.replace(/^\.\//, ''), FILTER))
  .map(key => ({
    key,
    name: path.basename(key, path.extname(key)),
    moduel: req(key),
    Component: req(key).default || req(key)
  }))
  .filter(component => !/^(\.|_)/.test(component.name))
  .filter(component => typeof component.Component === 'function')

const initialComponents = getComponents(req)

const Index = ({ routes = [] }) => (
  <React.Fragment>
    <pre>{DIRNAME}</pre>
    <ul>
      {routes.map(route => (
        <li key={route.key}>
          <Link to={route.path}>
            {route.name}
          </Link>
        </li>
      ))}
    </ul>
  </React.Fragment>
)

const DefaultApp = ({ render, routes }) => (
  <Switch>
    {render()}
    <Route render={props => (
      <Index
        {...props}
        routes={routes}
      />
    )} />
  </Switch>
)

class Catch extends React.Component {
  static getDerivedStateFromProps (props, state) {
    if (!state.err) return null
    return { err: null }
  }

  state = {
    err: null
  }

  componentDidCatch (err) {
    this.setState({ err })
  }

  render () {
    const { err } = this.state

    if (err) {
      return (
        <pre
          children={err.toString()}
          style={{
            color: 'white',
            backgroundColor: 'red',
            fontFamily: 'Menlo, monospace',
            fontSize: '14px',
            margin: 0,
            padding: '16px',
            minHeight: '128px',
            whiteSpace: 'prewrap'
          }}
        />
      )
    }

    return this.props.children
  }
}

const ScrollTop = withRouter(class extends React.Component {
  componentDidUpdate(prevProps) {
    if (this.props.location.pathname !== prevProps.location.pathname) {
      window.scrollTo(0, 0)
    }
  }
  render () {
    return false
  }
})

const Router = IS_CLIENT ? BrowserRouter : StaticRouter
const App = withRouter(APP ? (require(APP).default || require(APP)) : DefaultApp)

export const getRoutes = async (components = initialComponents) => {
  const routes = await components.map(async ({ key, name, module, Component }) => {
    const exact = name === index
    let pathname = exact ? '/' : '/' + name
    const props = Component.getInitialProps
      ? await Component.getInitialProps({ path: pathname })
      : {}
    pathname = props.path || pathname
    return {
      key: name,
      name,
      path: pathname,
      exact,
      module,
      Component,
      props
    }
  })
  return Promise.all(routes)
}

export default class Root extends React.Component {
  static defaultProps = {
    path: '/',
    basename
  }
  state = this.props

  render () {
    const {
      routes,
      basename,
      path = '/'
    } = this.state

    return (
      <Router
        context={{}}
        basename={basename}
        location={path}>
        <React.Fragment>
          <Catch>
            <App
              routes={routes}
              render={appProps => (
                routes.map(({ Component, ...route }) => (
                  <Route
                    {...route}
                    render={props => (
                      <Catch>
                        <Component
                          {...props}
                          {...appProps}
                          {...route.props}
                        />
                      </Catch>
                    )}
                  />
                ))
              )}
            />
          </Catch>
          {!disableScroll && <ScrollTop />}
        </React.Fragment>
      </Router>
    )
  }
}

let app
if (IS_CLIENT) {
  const mount = DEV ? render : hydrate
  const div = window.root || document.body.appendChild(
    document.createElement('div')
  )
  getRoutes()
    .then(routes => {
      app = mount(<Root routes={routes} />, div)
    })
}

if (IS_CLIENT && module.hot) {
  module.hot.accept()
}

