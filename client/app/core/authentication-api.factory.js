import base64js from 'base64-js'
const TextEncoderLite = require('text-encoder-lite').TextEncoderLite
const ssoAuthModes = ['oidc', 'saml']

// utf8-capable window.btoa
function base64encode (str, encoding = 'utf-8') {
  let bytes = new (window.TextEncoder || TextEncoderLite)(encoding).encode(str)
  return base64js.fromByteArray(bytes)
}


/** @ngInject */
export function AuthenticationApiFactory ($http, API_BASE, Session, Notifications) {

  const self = this
  self.currentAuthMode = null
  var service = {
    globalLogin: globalLogin,
    login: login,
    ssoLogin: ssoLogin
  }

  return service

  function updateSsoHeaders (result) {
    // @note: maybe we do not need to set headers "permanently" like this?
    $http.defaults.headers.common['X-REMOTE-USER'] = result.headers('X_REMOTE_USER')
    $http.defaults.headers.common['X-REMOTE-USER-FULLNAME'] = result.headers('X_REMOTE_USER_FULLNAME')
    $http.defaults.headers.common['X-REMOTE-USER-FIRSTNAME'] = result.headers('X_REMOTE_USER_FIRSTNAME')
    $http.defaults.headers.common['X-REMOTE-USER-LASTNAME'] = result.headers('X_REMOTE_USER_LASTNAME')
    $http.defaults.headers.common['X-REMOTE-USER-EMAIL'] = result.headers('X_REMOTE_USER_EMAIL')
    $http.defaults.headers.common['X-REMOTE-USER-GROUPS'] = result.headers('X_REMOTE_USER_GROUPS')
  }

  function globalLogin (authMode, userLogin, password) {
    if (ssoAuthModes.indexOf(authMode) !== -1){
      self.currentAuthMode = authMode
      return ssoLogin()
    } else {
      self.currentAuthMode = 'local'
      return login(userLogin, password)
    }
  }

  // External (SSO) Authentication
  function ssoLogin () {
    return new Promise((resolve, reject) => {

      console.log('Entering in ssoLogin')

      // First, let's retrieve SSO user info 
      $http.get(API_BASE + '/ui/service/oidc_userinfo')
      .then(function (result) {
          updateSsoHeaders(result)
          // Then we can perform an SSO auth API request
          $http.get(API_BASE + '/api/sso/auth?requester_type=ui', {
          }).then(loginSuccess, loginFailure)

        }, function (errMsg) {
          reject(errMsg)
      })

      function loginSuccess (response) {
        console.log("ssoLogin > loginSuccess > response.data: ", response.data)
        Session.setAuthToken(response.data.auth_token)
        Session.setAuthMode(self.currentAuthMode)
        resolve(response)
      }

      function loginFailure (response) {
        Session.destroy()
        reject(response)
      }

        })
      }

  // Local authentication
  function login (userLogin, password) {
    return new Promise((resolve, reject) => {
      $http.get(API_BASE + '/api/auth?requester_type=ui', {
        headers: {
          'Authorization': 'Basic ' + base64encode([userLogin, password].join(':')),
          'X-Auth-Token': undefined
        }
      }).then(loginSuccess, loginFailure)

      function loginSuccess (response) {
        console.log("login > loginSuccess > response.data: ", response.data)
        Session.setAuthToken(response.data.auth_token)
        Session.setAuthMode(self.currentAuthMode)
        resolve(response)
      }

      function loginFailure (response) {
        Session.destroy()
        reject(response)
      }

    })
  }
}
