import pytest


@pytest.fixture(autouse=True)
def _disable_throttling(settings):
    """Functional tests reuse the same test-client address for every request,
    so DRF's rate throttles (meant to bound real traffic) would otherwise trip
    across unrelated tests in the same run. Views like login/register attach
    their throttle classes directly (not via DEFAULT_THROTTLE_CLASSES), so the
    reliable way to disable them is to null out each scope's rate — DRF treats
    a None rate as "unthrottled" regardless of which class is attached."""
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        'DEFAULT_THROTTLE_RATES': {
            scope: None for scope in settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']
        },
    }
