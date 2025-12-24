import OSS from 'ali-oss';

import { MAX_FILE_SIZE_BYTES, validateAttachmentMeta } from './media';
import { chatService } from '../services/api';

/**
 * ========= STS 管理相关（方案：前端主动管理生命周期） =========
 */

let ossClientPromise: Promise<any> | null = null;

/**
 * 当前这份 STS 的绝对过期时间戳（毫秒）
 * - 每次从后端获取 STS 时更新
 * - getOssClient 会根据它决定是否需要重建 client
 */
let stsExpireAt = 0;

/** 标记当前是否正在创建/重建 OSS 客户端，防止并发重复创建 */
let isCreatingClient = false;

/**
 * 当后端没给出明确的过期时间时，使用的默认 TTL
 * 后端 STS 有效期为 10 分钟，这里作为兜底
 */
const STS_DEFAULT_TTL_MS = 10 * 60 * 1000; // 10min

/**
 * 安全裕度：提早这么多毫秒认为 “STS 将要过期，需要重建 client”
 * 比如 TTL = 10min，margin = 2min，则从第 8min 开始就会主动换一次 STS
 */
const STS_SAFE_MARGIN_MS = 2 * 60 * 1000; // 2min

// SDK 自动刷新间隔，用于大文件上传过程中的续期
const STS_REFRESH_INTERVAL_MS = 4 * 60 * 1000;

/** STS 返回的数据结构（可以按你后端实际返回调整字段名） */
type OssStsData = {
  accessKeyId: string;
  accessKeySecret: string;
  securityToken: string;
  bucket: string;
  region?: string;
  endpoint?: string;
  /**
   * - 返回「绝对过期时间戳（毫秒）」：如 1733280000000
   */
  expiresIn?: number;
};

/** 简单断言 STS 返回值，避免字段缺失导致 OSS 初始化时才报错 */
function assertValidStsData(datas: any): asserts datas is OssStsData {
  if (!datas) {
    throw new Error('上传服务暂不可用，请稍后重试');
  }
  const required = [
    'accessKeyId',
    'accessKeySecret',
    'securityToken',
    'bucket'
  ];
  for (const key of required) {
    if (!datas[key]) {
      throw new Error('上传服务配置缺失，请稍后重试');
    }
  }
}

/**
 * 根据后端返回的 expiresIn 计算绝对过期时间
 * 支持几种情况：
 * 1）明显是「时间戳毫秒」：大于当前时间一段距离（> now + 60s）
 * 3）否则使用默认 TTL
 */
function calcStsExpireAt(expiresIn: number | undefined): number {
  const now = Date.now();

  if (typeof expiresIn === 'number' && expiresIn > 0) {
    // 看起来像“未来的绝对时间戳（毫秒）”
    if (expiresIn > now + 60 * 1000) {
      return expiresIn;
    }
  }

  // 兜底：用默认 10min
  return now + STS_DEFAULT_TTL_MS;
}

/**
 * 创建新 OSS 客户端并更新 stsExpireAt
 */
async function createOssClient() {
  const resp = await chatService.getOssConfig();
  const datas = (resp as any)?.data; // Adjusted to match standard API response format which usually puts payload in 'data'
  // Note: Original code used (resp as any)?.datas. I will check api.ts and server.js to ensure consistency.
  // Standard response is { success: true, data: { ... } }. So `resp` is the axios data? No, request.ts returns response.data?
  // Let's check request.ts. 
  // request.ts returns response.data directly?
  // No, let's assume request.ts returns the payload.
  // If request.ts returns the full object { success, data, ... }, then `resp.data` is correct context.
  // Let's stick to consistent naming. Server sends `data`.

  // Actually, let's look at `api.ts` -> `http.get`. 
  // If `http.get` returns `Promise<T>`, and `T` is the data payload?
  // Usually `utils/request` in this project returns the data directly if success, or throws?
  // Step 509: `return http.get<User[]>...`
  // Step 112 (view_file request.ts): 
  // It returns `response.data`.
  // So if server returns `{ success: true, data: ... }`, then the return value IS that object.
  // So `resp.data` is likely where the payload is.

  assertValidStsData(datas);

  // 初次 STS 过期时间
  stsExpireAt = calcStsExpireAt(datas.expiresIn);
  console.log(
    '[OSS] 初始 STS 生效，expireAt =',
    new Date(stsExpireAt).toLocaleString(),
  );

  const client = new OSS({
    accessKeyId: datas.accessKeyId,
    accessKeySecret: datas.accessKeySecret,
    stsToken: datas.securityToken,
    bucket: datas.bucket,
    region: datas.region,
    endpoint: datas.endpoint,
    secure: true, // 强制 HTTPS

    // 自带刷新，用于大文件上传过程中的续期
    refreshSTSToken: async () => {
      console.log('[OSS] refreshSTSToken 被调用');
      const nextResp = await chatService.getOssConfig();
      const next = (nextResp as any)?.data;
      assertValidStsData(next);

      // 这里也要更新 stsExpireAt，保证和 client 内部的 STS 一致
      stsExpireAt = calcStsExpireAt(next.expiresIn);
      console.log(
        '[OSS] refreshSTSToken 新 STS 生效，expireAt =',
        new Date(stsExpireAt).toLocaleString(),
      );

      return {
        accessKeyId: next.accessKeyId,
        accessKeySecret: next.accessKeySecret,
        stsToken: next.securityToken,
      };
    },
    refreshSTSTokenInterval: STS_REFRESH_INTERVAL_MS,
  });

  return client;
}

/**
 * 获取单例 OSS 客户端
 * - 如果当前没有 client，或 STS 即将过期/已过期，则重建 client
 * - 这样可以避免使用已过期的 STS 去签名 / 上传
 */
export async function getOssClient() {
  const now = Date.now();
  const isExpiring = stsExpireAt > 0 && now >= stsExpireAt - STS_SAFE_MARGIN_MS;

  // 需要创建或重建的条件：没有 client，或者 STS 即将过期/已过期
  const needRecreate = !ossClientPromise || isExpiring;

  if (needRecreate && !isCreatingClient) {
    // 只有“第一个”进入的调用会走到这里
    isCreatingClient = true;
    console.log(
      '[OSS] 准备创建/重建 OSS 客户端，stsExpireAt =',
      stsExpireAt,
      'now =',
      now,
    );

    ossClientPromise = createOssClient()
      .then((client) => {
        // createOssClient 里会更新 stsExpireAt
        return client;
      })
      .catch((err) => {
        // 创建失败，下次再试
        ossClientPromise = null;
        console.error('[OSS] 创建客户端失败：', err);
        throw err;
      })
      .finally(() => {
        isCreatingClient = false;
      });
  }

  if (!ossClientPromise) {
    // 极端情况下（刚好创建失败，又立刻被调用），兜个错
    throw new Error('上传服务暂不可用，请稍后重试');
  }

  return ossClientPromise;
}

/**
 * buildKey 上下文：便于按业务自由生成 key
 */
export type BuildKeyContext = {
  filename: string;
  ext: string;
  mime: string;
  size: number;
  uuid: string;
  date: {
    y: number;
    m: number;
    d: number;
  };
};

export type BuildKeyFn = (ctx: BuildKeyContext) => string;

/**
 * 图片压缩参数
 * - maxWidth / maxHeight：等比缩放不超过该宽高
 * - quality：0~1，越小压缩越狠
 * - mimeType：输出格式，默认保留原 mime（如果是 jpeg/png）
 */
export type ImageCompressOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: string;
};

/**
 * 上传配置项
 * - prefix: 仅在未提供 buildKey 时作为默认目录前缀（如 chat、eqa-biz/assets 等）
 * - onProgress: 上传进度回调，单位为百分比 0-100
 * - buildKey: 自定义构建 OSS 对象 key 的函数（优先级最高）
 * - sizeThreshold: put 与 multipartUpload 的分界线（字节），默认 5MB
 * - forceMultipart: 强制使用分片上传（忽略 sizeThreshold）
 * - forcePut: 强制使用简单上传 put（忽略 sizeThreshold，不建议用于超大文件）
 * - withSignedUrl: 是否在结果中附带临时访问 URL（默认 true）
 * - signedUrlExpires: 临时访问 URL 过期时间（秒），默认 3600 秒
 * - compressImage: 是否对图片进行压缩，默认 true（仅 image/* 生效）
 * - compressOptions: 图片压缩参数（最大宽高、质量等）
 * - minVideoDurationSeconds: 视频最小时长（秒），默认 1 秒
 */
export type UploadOptions = {
  prefix?: string;
  onProgress?: (percent: number) => void;
  buildKey?: BuildKeyFn;
  sizeThreshold?: number;
  forceMultipart?: boolean;
  forcePut?: boolean;
  withSignedUrl?: boolean;
  signedUrlExpires?: number;
  compressImage?: boolean;
  compressOptions?: ImageCompressOptions;
};

/**
 * OSS 上传结果
 * - key: OSS 对象键（Object Key）
 * - ossObjectKey: 与 key 相同，方便语义区分
 * - signedUrl: 可访问 URL（带签名，仅在 withSignedUrl=true 时返回）
 * - mime: 文件 MIME 类型（注意：图片压缩后可能变成 image/jpeg）
 * - etag: 文件 ETag（用于校验）
 * - size: 文件大小（字节）（压缩后大小）
 * - requestId: OSS 请求 ID，便于排障
 */
export type OssUploadResult = {
  key: string;
  ossObjectKey: string;
  signedUrl?: string;
  mime: string;
  etag?: string;
  size: number;
  requestId?: string;
};

/**
 * 签名 URL 选项
 * after expires seconds, the url will become invalid, default is 1800 seconds
 * - process: 处理参数（如图片缩放），格式为 `image/resize,w_100,h_100`
 */
export type SignedUrlOptions = {
  expires?: number;
  process?: string;
};

/**
 * 规范化文件名
 * - 移除首尾空格
 * - 替换空格为下划线
 * - 移除非字母数字、下划线、短横线、点号的字符
 * - 如果结果为空，添加默认前缀 `file-` 后跟时间戳
 */
export function normalizeFilename(name: string) {
  const base = typeof name === 'string' && name.trim() ? name : 'file';
  const replaced = base.replace(/\s+/g, '_').replace(/[^\w\-.]/g, '');
  return replaced || `file-${Date.now()}`;
}

/**
 * 默认构建 OSS 对象键
 * - 格式：{prefix}/{y}/{m}/{uuid}.{ext}
 * - 例如：uploads/2023/08/1234567890abcdef1234567890abcdef.jpg
 */
function buildDefaultObjectKey(
  prefix: string | undefined,
  ctx: BuildKeyContext,
) {
  const p = (prefix || 'uploads').replace(/\/+$/g, '').replace(/^\/+/, '');
  const y = ctx.date.y;
  const m = String(ctx.date.m).padStart(2, '0');
  return `${p}/${y}/${m}/${ctx.uuid}.${ctx.ext}`;
}

/**
 * 根据文件大小选择 put 或 multipartUpload 的分界线
 * 默认 5MB
 */
const DEFAULT_SIZE_THRESHOLD = 5 * 1024 * 1024;

/**
 * 是否为图片 mime
 */
function isImageMime(mime: string) {
  return /^image\//i.test(mime);
}

/**
 * 使用 canvas 压缩图片（浏览器环境）
 * - 如果环境不支持（如 SSR / 无 canvas），会直接返回原始 blob
 */
async function compressImageIfNeeded(
  file: File | Blob,
  mime: string,
  options?: ImageCompressOptions,
): Promise<{ blob: Blob; mime: string; size: number }> {
  const isBrowser =
    typeof window !== 'undefined' && typeof document !== 'undefined';
  if (!isBrowser || !isImageMime(mime)) {
    const size = (file as any).size ?? 0;
    return { blob: file, mime, size };
  }

  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.8,
    mimeType,
  } = options || {};

  const targetMime =
    typeof mimeType === 'string' && mimeType.trim()
      ? mimeType
      : mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/jpg'
        ? mime
        : 'image/jpeg';

  // FileReader 读取为 dataURL
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('图片处理失败，请重试'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片处理失败，请重试'));
    image.src = dataUrl;
  });

  const originWidth = img.naturalWidth || img.width;
  const originHeight = img.naturalHeight || img.height;

  if (!originWidth || !originHeight) {
    const size = (file as any).size ?? 0;
    return { blob: file, mime, size };
  }

  // 等比缩放计算目标宽高
  const widthRatio = maxWidth / originWidth;
  const heightRatio = maxHeight / originHeight;
  const ratio = Math.min(widthRatio, heightRatio, 1); // 不放大，只缩小

  const targetWidth = Math.round(originWidth * ratio);
  const targetHeight = Math.round(originHeight * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const size = (file as any).size ?? 0;
    return { blob: file, mime, size };
  }

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const blob: Blob = await new Promise((resolve, reject) => {
    if (!(typeof canvas.toBlob === 'function')) {
      try {
        const dataUrl = canvas.toDataURL(targetMime, quality);
        const arr = dataUrl.split(',');
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        resolve(new Blob([u8arr], { type: targetMime }));
      } catch (e) {
        reject(e);
      }
      return;
    }
    canvas.toBlob(
      (b) => {
        if (!b) {
          reject(new Error('图片处理失败，请重试'));
        } else {
          resolve(b);
        }
      },
      targetMime,
      quality,
    );
  });

  const size = (blob as any).size ?? 0;
  return { blob, mime: targetMime, size };
}

/**
 * 上传文件到 OSS（自动选择 put / multipartUpload + 默认图片压缩）
 * @param file 要上传的文件（File 或 Blob）
 * @param options 上传配置项
 */
export async function uploadFileToOss(
  file: File | Blob | null | undefined,
  options: UploadOptions = {},
): Promise<OssUploadResult> {
  if (!file) {
    throw new Error('未选择文件，无法上传');
  }

  const filename = file instanceof File && file.name ? file.name : 'blob';
  const safeName = normalizeFilename(filename);
  const ext = safeName.includes('.') ? safeName.split('.').pop()! : 'bin';
  const originMime =
    file instanceof File && file.type ? file.type : 'application/octet-stream';

  // ====== A）上传前安全校验（大小/类型/风险扩展名） ======
  {
    const rawSize = (file as any).size ?? 0;
    const v = validateAttachmentMeta(safeName, originMime, rawSize);
    if (!v.ok) {
      throw new Error(`上传被拒绝：${v.reason}`);
    }
  }

  // ====== C）图片压缩逻辑（默认开启，仅 image/* 生效） ======
  const shouldCompress =
    options.compressImage !== false && isImageMime(originMime);

  const {
    blob: uploadBlob,
    mime,
    size,
  } = shouldCompress
      ? await compressImageIfNeeded(file, originMime, options.compressOptions)
      : {
        blob: file,
        mime: originMime,
        size: (file as any).size ?? 0,
      };

  // ====== D）压缩后再次校验大小（防止超过限制） ======
  if (size > MAX_FILE_SIZE_BYTES) {
    throw new Error('文件大小超过限制，无法上传');
  }

  const now = new Date();
  const ctx: BuildKeyContext = {
    filename: safeName,
    ext, // 这里仍保留原始扩展名；如果你想按 mime 改后缀，可以在这里额外处理
    mime,
    size,
    uuid:
      typeof crypto !== 'undefined' &&
        (crypto as any).randomUUID &&
        typeof (crypto as any).randomUUID === 'function'
        ? (crypto as any).randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    date: {
      y: now.getFullYear(),
      m: now.getMonth() + 1,
      d: now.getDate(),
    },
  };

  // 1）生成对象 key：优先使用业务自定义 buildKey，其次使用默认规则；统一加上根前缀 im-biz
  const rawKey = options.buildKey
    ? options.buildKey(ctx)
    : buildDefaultObjectKey(options.prefix, ctx);

  const cleanedRawKey = String(rawKey || '').replace(/^\/+/, '');
  if (!cleanedRawKey) {
    throw new Error('文件路径生成失败，请稍后重试');
  }

  // 2）确保 key 以 im-biz/ 开头
  const key = cleanedRawKey.startsWith('im-biz/')
    ? cleanedRawKey
    : `im-biz/${cleanedRawKey}`;

  // 3）根据大小 / 强制选项选择 put 或 multipartUpload
  const threshold =
    typeof options.sizeThreshold === 'number' && options.sizeThreshold > 0
      ? options.sizeThreshold
      : DEFAULT_SIZE_THRESHOLD;

  const useMultipart = options.forceMultipart
    ? true
    : options.forcePut
      ? false
      : size >= threshold;

  let res: any;
  const client = await getOssClient();
  try {
    if (!useMultipart) {
      // 小文件：简单上传 put（带模拟进度）

      let timer: number | null = null;
      let current = 0;

      if (options.onProgress && typeof window !== 'undefined') {
        current = 5;
        options.onProgress(current);

        // 模拟上传进度：5%~90%，每 120ms 增加 3~8%
        timer = window.setInterval(() => {
          const inc = 3 + Math.round(Math.random() * 5); // 3~8%
          current = Math.min(current + inc, 90);
          options.onProgress!(current);

          if (current >= 90 && timer !== null) {
            clearInterval(timer);
            timer = null;
          }
        }, 120);
      }

      try {
        res = await client.put(key, uploadBlob, {
          headers: {
            'Content-Type': mime,
          },
        });
        // 上传成功后，直接打到 100%
        if (options.onProgress) {
          options.onProgress(100);
        }
      } catch (err) {
        console.error('[OSS] 小文件 put 上传失败：', err);
        throw err;
      } finally {
        if (timer !== null) {
          clearInterval(timer);
          timer = null;
        }
      }
    } else {
      // 大文件：分片上传 multipartUpload
      res = await client.multipartUpload(key, uploadBlob, {
        headers: {
          'Content-Type': mime,
        },
        progress: (p: number) => {
          if (options.onProgress) {
            options.onProgress(Math.round(p * 100));
          }
        },
      });
    }
  } catch (err) {
    console.error('[OSS] 上传失败：', err);
    throw err;
  }

  const etag =
    res?.etag ||
    res?.res?.headers?.etag ||
    res?.res?.headers?.ETag ||
    undefined;
  const requestId = res?.res?.headers?.['x-oss-request-id'];

  // 3）按需生成签名 URL（用于前端直接预览）
  let signedUrl: string | undefined;
  if (options.withSignedUrl !== false) {
    const expires =
      typeof options.signedUrlExpires === 'number' &&
        options.signedUrlExpires > 0
        ? options.signedUrlExpires
        : 3600;
    try {
      signedUrl = client.signatureUrl(key, { expires });
    } catch (err) {
      // 签名 URL 生成失败时，不抛出异常，仅记录警告日志
      console.warn('[OSS] 生成签名 URL 失败：', err);
    }
  }

  return {
    key,
    ossObjectKey: key,
    signedUrl,
    mime,
    etag,
    size,
    requestId,
  };
}

/**
 * 获取 OSS 对象的可访问 URL（带签名）
 */
export async function getSignedUrl(
  ossObjectKey: string,
  opts?: SignedUrlOptions,
): Promise<string> {
  if (!ossObjectKey) {
    throw new Error('文件地址缺失，无法生成访问链接');
  }
  console.log('getSignedUrl-----', ossObjectKey);
  if (/^(blob:|data:)/i.test(ossObjectKey)) return ossObjectKey;
  if (/^https?:\/\//i.test(ossObjectKey)) return ossObjectKey;

  try {
    const client = await getOssClient();
    console.log('getSignedUrl client-----', client);
    return client.signatureUrl(ossObjectKey, opts);
  } catch (err) {
    console.warn(
      '[OSS] getSignedUrl 调用异常，ossObjectKey =',
      ossObjectKey,
      err,
    );
    throw err;
  }
}