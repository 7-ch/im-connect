import { devConfig } from './config/dev';
import { testConfig } from './config/test';
import { preConfig } from './config/pre';
import { prodConfig } from './config/prod';
import { EnvType, Config } from './config/types';

const ENV_CONFIGS: Record<EnvType, Config> = {
  dev: devConfig,
  test: testConfig,
  pre: preConfig,
  prod: prodConfig
};

// 获取当前环境
const getEnv = (): EnvType => {
  const hostname = window.location.hostname;
  
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
     // 默认返回 test，方便本地连接测试环境调试
     return 'test'; 
  }
  if (hostname.includes('test')) return 'test';
  if (hostname.includes('pre')) return 'pre';
  if (hostname === '17an.com' || hostname === 'www.17an.com') return 'prod';
  
  return 'test'; // 默认回退到测试环境
};

export const currentEnv = getEnv();
export const config = ENV_CONFIGS[currentEnv];
export type { EnvType, Config };

console.log(`Current Environment: ${currentEnv}, API: ${config.apiUrl}`);