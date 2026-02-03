import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/client-zip.browser.js',
    format: 'umd',
    name: 'clientZip', // exposes clientZip.downloadZip, etc.
  },
  plugins: [
    resolve(),
    commonjs(),
    typescript(),
    terser()
  ]
};
