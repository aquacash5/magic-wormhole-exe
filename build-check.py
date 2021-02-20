import requests
pypi = requests.get("https://pypi.org/pypi/magic-wormhole/json").json()
github_releases = requests.get(
    "https://api.github.com/repos/aquacash5/magic-wormhole-exe/releases").json()

pypi_version = pypi['info']['version']
release_tags = [release['tag_name'] for release in github_releases]

has_release = pypi_version in release_tags

print(f'::set-output name=version::{pypi["info"]["version"]}')
print(f'::set-output name=release_exists::{1 if has_release else 0}')
