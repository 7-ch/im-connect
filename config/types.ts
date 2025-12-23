export type EnvType = 'dev' | 'test' | 'pre' | 'prod';

export interface Config {
  apiUrl: string;
  env: EnvType;
  timeout: number;
}