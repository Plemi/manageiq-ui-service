import templateUrl from './dashboard.html'

export const DashboardComponent = {
  templateUrl,
  controller: ComponentController,
  controllerAs: 'vm'
}

/** @ngInject */
function ComponentController ($state, DashboardService, EventNotifications, lodash, Chargeback, RBAC, Polling) {
  const vm = this

  const retiredTitle = __('Retire Status')

  vm.$onDestroy = function onDestroy () {
    Polling.stop('vmPolling')
  }
  vm.$onInit = function () {
    vm.permissions = {
      'monthlyCharges': RBAC.has(RBAC.FEATURES.DASHBOARD.VIEW.MONTHLY_CHARGES)
    }

    angular.extend(vm, {
      requestsFeature: false,
      servicesFeature: false,
      servicesCount: {
        total: 0,
        current: 0,
        retired: 0,
        soon: 0
      },
      requestsCount: {
        total: 0,
        pending: 0,
        approved: 0,
        denied: 0
      },
      chargeback: 0,
      navigateToRetiringSoonServicesList: navigateToRetiringSoonServicesList,
      navigateToRetiredServicesList: navigateToRetiredServicesList,
      navigateToCurrentServicesList: navigateToCurrentServicesList
    })

    resolveServiceCounts()
    resolveRequestCounts()
  }

  function navigateToRetiredServicesList () {
    $state.go('services', {
      'filter': [{
        'id': 'retired',
        'title': retiredTitle,
        'value': {id: true, title: __('Retired')}
      }]
    })
  }

  function navigateToRetiringSoonServicesList () {
    const currentDate = new Date()
    const filters = []

    filters.push({'id': 'retired', 'title': retiredTitle, 'value': {id: false, title: __('Retires between')}})
    filters.push({'id': 'retires_on', 'operator': '>', 'value': {id: currentDate.toISOString(), title: __('Now')}})
    const days30 = currentDate.setDate(currentDate.getDate() + 30)
    filters.push({
      'id': 'retires_on',
      'operator': '<',
      'value': {id: new Date(days30).toISOString(), title: __('30 Days')}
    })

    $state.go('services', {'filter': filters})
  }

  function navigateToCurrentServicesList () {
    $state.go('services', {
      'filter': [{
        'id': 'retired',
        'title': retiredTitle,
        'value': {id: false, title: __('Not Retired')}
      }]
    })
  }

  function resolveServiceCounts () {
    if (RBAC.has('service_view') && RBAC.has(RBAC.FEATURES.SERVICES.VIEW)) {
      Promise.all(DashboardService.allServices()).then((response) => {
        let services = response[0].resources
        vm.servicesCount.total = response[0].subcount
        vm.servicesCount.retired = response[1].subcount
        vm.servicesCount.soon = response[2].subcount
        vm.servicesCount.current = vm.servicesCount.total - vm.servicesCount.retired
        services.forEach(Chargeback.processReports)
        vm.chargeback = {
          'used_cost_sum': lodash(services).map('chargeback').map('used_cost_sum').values().sum()
        }
        vm.servicesFeature = true
      }).catch(reason => {

      })
    }
  }

  function resolveRequestCounts () {
    if (RBAC.has('miq_request_view')) {
      Promise.all(DashboardService.allRequests()).then((response) => {
        vm.requestsCount.pending = response[0].subcount + response[1].subcount
        vm.requestsCount.approved = response[2].subcount + response[3].subcount
        vm.requestsCount.denied = response[5].subcount + response[4].subcount
        vm.requestsCount.total = vm.requestsCount.pending + vm.requestsCount.approved + vm.requestsCount.denied
        vm.requestsFeature = true
      }).catch(reason => {

      })
    }
  }
}
