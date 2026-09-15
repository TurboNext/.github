# ar-python-publish

Mints a short-lived `pypi-tn` publisher token (via
[`ar-python-token`](../ar-python-token/)) and `twine upload`s one or more
dist globs. Optionally also publishes the same dist to a second
channel/repository in the same run — e.g. a CUDA-variant repo plus
`stable`, when the build happens to be the configured default variant.

## Usage

Simple case — one repository:

```yaml
- uses: TurboNext/.github/.github/actions/ar-python-publish@main
  with:
    gcp-sa-key: ${{ secrets.PYPI_TN_PUBLISHER_KEY }}
    channel: cu129   # or repository: pypi-tn-cu129
```

`dist-glob` defaults to `dist/*`; pass it explicitly if your build output
lives elsewhere (e.g. `./*.whl` for a promote workflow working in the
job's root, or `dist/cu129/*.whl` for a CUDA-namespaced build dir).

Dual-channel case — also publish to `stable` when this build is the
default variant:

```yaml
- uses: TurboNext/.github/.github/actions/ar-python-publish@main
  with:
    gcp-sa-key: ${{ secrets.PYPI_TN_PUBLISHER_KEY }}
    dist-glob: dist/cu${{ steps.vars.outputs.cuda_nodot }}/*.whl
    channel: cu${{ steps.vars.outputs.cuda_nodot }}
    also-channel: ${{ steps.vars.outputs.cuda_version == needs.prepare.outputs.cuda_default && 'stable' || '' }}
```

Leave both `also-repository`/`also-channel` empty (the default) to skip
the second publish entirely — that ternary pattern is how to make it
conditional based on a runtime value, since the inputs themselves can't
carry an `if`.

## What it doesn't cover

If your job has real build steps before the upload (PyArmor obfuscation,
a matrix build, retagging a wheel) — that's normal, keep those as their
own steps and just add this one at the end. If you have *no* custom
build step at all (checkout → `python -m build` → upload is enough),
[`reusable_pypi_publish.yml`](../../workflows/reusable_pypi_publish.yml)
wraps this whole job for you instead.

## Inputs / outputs

See [`action.yml`](./action.yml).
