/** @ngInject */
export function OidcUserinfoState (routerHelper) {
  routerHelper.configureStates(getStates())
}

function getStates () {
  return {
    'oidc-userinfo': {
      parent: 'application',
      url: '/oidc_userinfo',
      template: '<ui-view></ui-view>'
    }
  }
}