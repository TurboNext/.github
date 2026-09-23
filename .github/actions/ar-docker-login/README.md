# ar-docker-login

Authenticates Docker against a GCP Artifact Registry Docker repository —
the Azure Container Registry replacement. One action covers both
directions: pass the **publisher** key to push, the **reader** key to
pull.

Unlike the Python side (`ar-python-token`), there's nothing to wrap this
in — `docker login` followed by plain `docker build`/`push`/`pull` is
already the whole shape, for both a build job and a pull-only job like an
orphan cleanup.

## Usage

Push (release job):

```yaml
- uses: TurboNext/.github/.github/actions/ar-docker-login@main
  with:
    gcp-sa-key: ${{ secrets.CDKTF_TN_PUBLISHER_KEY }}

- run: |
    docker build -t europe-west1-docker.pkg.dev/turbonext-first-project/cdktf-tn/cli:latest .
    docker push europe-west1-docker.pkg.dev/turbonext-first-project/cdktf-tn/cli:latest
```

Pull (a consumer job):

```yaml
- uses: TurboNext/.github/.github/actions/ar-docker-login@main
  with:
    gcp-sa-key: ${{ secrets.CDKTF_TN_READER_KEY }}

- run: docker pull europe-west1-docker.pkg.dev/turbonext-first-project/cdktf-tn/cli:latest
```

`registry` is echoed back as an output (`{location}-docker.pkg.dev`) in
case a caller wants to build the image ref without repeating the region.

## Inputs / outputs

See [`action.yml`](./action.yml).
