declare module 'opencc-js' {
  interface ConverterOptions { from: string; to: string }
  export function Converter(opts: ConverterOptions): (text: string) => string;
}
