#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
cargo build --manifest-path native/Cargo.toml --target wasm32-unknown-unknown --release
mkdir -p public
cp native/target/wasm32-unknown-unknown/release/astra_native.wasm public/astra_native.wasm
