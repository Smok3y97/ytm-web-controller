import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import { builtinModules } from 'module';

export default {
  input: 'src/index.ts',
  output: {
    file: 'bin/plugin.js',
    format: 'esm',
    sourcemap: true
  },
  external: [
    ...builtinModules,
    ...builtinModules.map(m => `node:${m}`)
  ],
  plugins: [
    resolve({
      preferBuiltins: true,
      exportConditions: ['node']
    }),
    commonjs(),
    json(),
    typescript({
      tsconfig: './tsconfig.json',
      compilerOptions: {
        outDir: './bin'
      }
    }),
    terser({
      ecma: 2022,
      compress: {
        drop_console: false,
        drop_debugger: true
      },
      output: {
        comments: false
      }
    })
  ]
};
