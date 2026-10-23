from rest_framework import serializers


def integer(value, name, minimum=1, maximum=None):
    field = serializers.IntegerField(min_value=minimum, max_value=maximum)
    try:
        return field.run_validation(value)
    except serializers.ValidationError as exc:
        raise serializers.ValidationError({name: exc.detail}) from exc


def page_params(request, default_size=10, max_size=100):
    page = integer(request.query_params.get('page', 1), 'page')
    size = integer(request.query_params.get('page_size', default_size), 'page_size')
    return page, min(size, max_size)
