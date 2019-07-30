import templateUrl from './login.html'

/** @ngInject */
export function LoginState (routerHelper) {
  routerHelper.configureStates(getStates())
}

function getStates () {
  return {
    'login': {
      parent: 'blank',
      url: '/login',
      templateUrl,
      controller: StateController,
      controllerAs: 'vm',
      title: N_('Login'),
      data: {
        layout: 'blank'
      }
    }
  }
}

/** @ngInject */
function StateController ($window, $state, Text, RBAC, API_LOGIN, API_PASSWORD, AuthenticationApi, Session, $rootScope, Notifications, Language, ApplianceInfo, CollectionsApi) {
  const vm = this

  init()

  vm.text = Text.login
  vm.credentials = {
    login: API_LOGIN,
    password: API_PASSWORD
  }
  vm.onSubmit = onSubmit
  vm.initiateOidcLogin = initiateOidcLogin
  vm.initiateSamlLogin = initiateSamlLogin
  vm.initiateAdminLogin = initiateAdminLogin

  if ($window.location.href.includes('?timeout')) {
    Notifications.message('danger', '', __('Your session has timed out.'), true)
    Session.destroy()
  }

  if ($window.location.href.includes('?pause')) {
    const params = (new URL($window.document.location)).searchParams
    const pauseLength = params.get('pause')
    Session.setPause(pauseLength)
  }

  if ($window.location.href.includes('?needToFinalizeAuthServerSide')) {
    vm.needToFinalizeAuthServerSide = true
  }  

  if (Session.privilegesError) {
    Notifications.error(__('User does not have privileges to login.'))
    Session.destroy()
  }

  function initiateOidcLogin () {
    // $state.go('oidc-login', { needToFinalizeAuthServerSide: 1 })
    $window.location.href = '/ui/service/oidc_login?needToFinalizeAuthServerSide'
  }
  function initiateSamlLogin () {
    // @todo
  }
  function initiateAdminLogin () {
    $window.location.href = '/'
  }

  function getExtAuthMode () {
    let extAuthMode = null
    if (vm.authMode.oidc_enabled) {
      extAuthMode = 'oidc'
    } else if (vm.authMode.saml_enabled) {
      extAuthMode = 'saml'
    }
    return extAuthMode
  }

  function checkIfServerSideAuthRequired () {
    // @todo: check if not already authenticated server side
    vm.extAuthMode = getExtAuthMode() 
    return (null !== vm.extAuthMode)
  }

  function finalizeAuthServerSide () {
    if (checkIfServerSideAuthRequired()) {
      return AuthenticateUser() 
    }
  }

  function onSubmit () {
    return AuthenticateUser() 
  }

  function AuthenticateUser () {

    Session.timeoutNotified = false
    Session.privilegesError = false

    return AuthenticationApi.globalLogin(vm.extAuthMode, vm.credentials.login, vm.credentials.password)
    .then(Session.loadUser)
    .then(Session.requestWsToken)
    .then((response) => {
      if (angular.isDefined(response)) {
        Language.onLogin(response)
        ApplianceInfo.set(response)
        RBAC.setRole(response.identity.role)
      }
      if (RBAC.suiAuthorized()) {
        if (angular.isDefined($rootScope.notifications) && $rootScope.notifications.data.length > 0) {
          $rootScope.notifications.data.splice(0, $rootScope.notifications.data.length)
        }
        $window.location.href = $state.href('dashboard')
      } else {
        Session.privilegesError = true
        Notifications.error(__('You do not have permission to view the Service UI. Please contact your administrator to update your group permissions.'))
        Session.destroy()
      }
      if (null !== vm.extAuthMode) {
        vm.needToFinalizeAuthServerSide = false
      }
    })
    .catch((response) => {
      if (response.status === 401) {
        if (null === vm.extAuthMode) {
          vm.credentials.login = ''
          vm.credentials.password = ''
          vm.loginErrorMsg = __('Login failed, possibly invalid credentials. ')
        } else {
          vm.loginErrorMsg = __('External Login failed, sorry. ')
        }
        const message = response.data.error.message
        Notifications.message('danger', '', vm.loginErrorMsg + `(${message})`, false)
      }
      Session.destroy()
    })

  }

  function init () {
    CollectionsApi.query('product_info').then((response) => {
      vm.brandInfo = response.branding_info
      $rootScope.favicon = vm.brandInfo.favicon
      vm.authMode = response.auth_mode
      if (vm.needToFinalizeAuthServerSide) {
        finalizeAuthServerSide()
      }
    })
  }
}