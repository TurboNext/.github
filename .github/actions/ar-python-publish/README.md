# ar-python-publish

Mints a short-lived `pypi-tn` publisher token (via
[`ar-python-token`](../ar-python-token/)) and `twine upload`s one or more
dist globs.

## Usage

```yaml
- uses: TurboNext/.github/.github/actions/ar-python-publish@main
  with:
    gcp-sa-key: ${{ secrets.PYPI_TN_PUBLISHER_KEY }}
    channel: cu129   # or repository: pypi-tn-cu129
```

`dist-glob` defaults to `dist/*`; pass it explicitly if your build output
lives elsewhere (e.g. `./*.whl` for a promote workflow working in the
job's root, or `dist/cu129/*.whl` for a CUDA-namespaced build dir).

To publish the same dist to more than one repository/channel (e.g. a
CUDA-variant repo plus `stable`), call this action once per target:

```yaml
- uses: TurboNext/.github/.github/actions/ar-python-publish@main
  with:
    gcp-sa-key: ${{ secrets.PYPI_TN_PUBLISHER_KEY }}
    dist-glob: dist/cu${{ steps.vars.outputs.cuda_nodot }}/*.whl
    channel: cu${{ steps.vars.outputs.cuda_nodot }}

- if: steps.vars.outputs.cuda_version == needs.prepare.outputs.cuda_default
  uses: TurboNext/.github/.github/actions/ar-python-publish@main
  with:
    gcp-sa-key: ${{ secrets.PYPI_TN_PUBLISHER_KEY }}
    dist-glob: dist/cu${{ steps.vars.outputs.cuda_nodot }}/*.whl
    channel: stable
```

## What it doesn't cover

If your job has real build steps before the upload (PyArmor obfuscation,
a matrix build, retagging a wheel) — that's normal, keep those as their
own steps and just add this one at the end. If you have *no* custom
build step at all (checkout → `python -m build` → upload is enough),
[`reusable_pypi_publish.yml`](../../workflows/reusable_pypi_publish.yml)
wraps this whole job for you instead.

## Inputs / outputs

See [`action.yml`](./action.yml).
