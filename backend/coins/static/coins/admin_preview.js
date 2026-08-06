document.addEventListener('DOMContentLoaded', function () {
  var PREVIEW_GROUP_SIZE = 10
  var preview = document.getElementById('coin-live-preview')
  if (!preview) return

  function val(id) {
    var el = document.getElementById('id_' + id)
    return el ? Number(el.value) || 0 : 0
  }

  function calc(suffix) {
    var p1 = val('place_1_' + suffix)
    var p2 = val('place_2_' + suffix)
    var p3 = val('place_3_' + suffix)
    var effortAvg = (val('effort_min_' + suffix) + val('effort_max_' + suffix)) / 2
    var rest = Math.max(PREVIEW_GROUP_SIZE - 3, 0)
    return Math.round(p1 + p2 + p3 + rest * effortAvg)
  }

  function update() {
    preview.textContent =
      PREVIEW_GROUP_SIZE + " kishilik guruh · oddiy kun → " + calc('normal') +
      ' tangacha · katta kun → ' + calc('big') + ' tangacha'
  }

  var ids = [
    'place_1_normal', 'place_2_normal', 'place_3_normal', 'effort_min_normal', 'effort_max_normal',
    'place_1_big', 'place_2_big', 'place_3_big', 'effort_min_big', 'effort_max_big',
  ]
  ids.forEach(function (id) {
    var el = document.getElementById('id_' + id)
    if (el) el.addEventListener('input', update)
  })
  update()
})
