import React, { createElement } from "react"
import { Router, navigate as reachNavigate } from "@reach/router"
import { ScrollContext } from "gatsby-react-router-scroll"
import { apiRunner } from "./api-runner-browser"
import syncRequires from "./sync-requires"
import pages from "./pages.json"
import redirects from "./redirects.json"
import loader, { setApiRunnerForLoader } from "./loader"
import { hot } from "react-hot-loader"
import JSONStore from "./json-store"

import * as ErrorOverlay from "react-error-overlay"
console.log({ pages })

// Report runtime errors
ErrorOverlay.startReportingRuntimeErrors({
  onError: () => {},
  filename: `/commons.js`,
})
ErrorOverlay.setEditorHandler(errorLocation =>
  window.fetch(
    `/__open-stack-frame-in-editor?fileName=` +
      window.encodeURIComponent(errorLocation.fileName) +
      `&lineNumber=` +
      window.encodeURIComponent(errorLocation.lineNumber || 1)
  )
)

if (window.__webpack_hot_middleware_reporter__ !== undefined) {
  // Report build errors
  window.__webpack_hot_middleware_reporter__.useCustomOverlay({
    showProblems(type, obj) {
      if (type !== `errors`) {
        ErrorOverlay.dismissBuildError()
        return
      }
      ErrorOverlay.reportBuildError(obj[0])
    },
    clear() {
      ErrorOverlay.dismissBuildError()
    },
  })
}

setApiRunnerForLoader(apiRunner)
loader.addPagesArray(pages)
loader.addDevRequires(syncRequires)
window.___loader = loader

// Convert to a map for faster lookup in maybeRedirect()
const redirectMap = redirects.reduce((map, redirect) => {
  map[redirect.fromPath] = redirect
  return map
}, {})

// Check for initial page-load redirect
maybeRedirect(location.pathname)

// Call onRouteUpdate on the initial page load.
apiRunner(`onRouteUpdate`, {
  location: window.history.location,
  action: null,
})

// function attachToHistory(history) {
// if (!window.___history) {
// window.___history = history

// history.listen((location, action) => {
// if (!maybeRedirect(location.pathname)) {
// apiRunner(`onPreRouteUpdate`, { location, action })
// apiRunner(`onRouteUpdate`, { location, action })
// }
// })
// }
// }

function maybeRedirect(pathname) {
  const redirect = redirectMap[pathname]

  if (redirect != null) {
    const pageResources = loader.getResourcesForPathname(pathname)

    if (pageResources != null) {
      console.error(
        `The route "${pathname}" matches both a page and a redirect; this is probably not intentional.`
      )
    }

    window.history.replace(redirect.toPath)
    return true
  } else {
    return false
  }
}

function shouldUpdateScroll(prevRouterProps, { location: { pathname } }) {
  const results = apiRunner(`shouldUpdateScroll`, {
    prevRouterProps,
    pathname,
  })
  if (results.length > 0) {
    return results[0]
  }

  if (prevRouterProps) {
    const {
      location: { pathname: oldPathname },
    } = prevRouterProps
    if (oldPathname === pathname) {
      return false
    }
  }
  return true
}

const push = to => {
  reachNavigate(to)
}

const replace = to => {
  reachNavigate(to, { replace: true })
}

window.___push = push
window.___replace = replace
console.log(`hi?`)

const NoMatch = () => <div>ooooops</div>

class RouteHandler extends React.Component {
  render() {
    console.log(`RouteHandler`)
    const { location } = this.props
    const { pathname } = location
    const pageResources = loader.getResourcesForPathname(pathname)
    console.log({ pageResources })
    const isPage = !!(pageResources && pageResources.component)
    let child
    if (isPage) {
      child = (
        <JSONStore
          pages={pages}
          {...this.props}
          pageResources={pageResources}
        />
      )
    } else {
      const dev404Page = pages.find(p => /^\/dev-404-page/.test(p.path))
      child = createElement(
        syncRequires.components[dev404Page.componentChunkName],
        {
          pages,
          ...this.props,
        }
      )
    }

    return (
      <ScrollContext
        location={location}
        history={this.props.history}
        shouldUpdateScroll={shouldUpdateScroll}
      >
        {child}
      </ScrollContext>
    )
  }
}

const Root = () =>
  createElement(
    Router,
    {
      basepath: __PATH_PREFIX__,
    },
    createElement(RouteHandler, { default: true })
  )
// createElement(
// ScrollContext,
// { shouldUpdateScroll },
// createElement(Route, {
// // eslint-disable-next-line react/display-name
// render: routeProps => {
// attachToHistory(routeProps.history)
// const { pathname } = routeProps.location
// const pageResources = loader.getResourcesForPathname(pathname)
// const isPage = !!(pageResources && pageResources.component)
// if (isPage) {
// return createElement(JSONStore, {
// pages,
// ...routeProps,
// pageResources,
// })
// } else {
// const dev404Page = pages.find(p => /^\/dev-404-page/.test(p.path))
// return createElement(Route, {
// key: `404-page`,
// // eslint-disable-next-line react/display-name
// component: props =>
// createElement(
// syncRequires.components[dev404Page.componentChunkName],
// {
// pages,
// ...routeProps,
// }
// ),
// })
// }
// },
// })
// )
// )

// Let site, plugins wrap the site e.g. for Redux.
const WrappedRoot = apiRunner(`wrapRootComponent`, { Root }, Root)[0]

export default hot(module)(WrappedRoot)
