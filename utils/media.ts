/**
 * 媒体与附件处理工具：
 * - 常量：允许/禁止的扩展名与 MIME 类型
 * - 工具：将服务端 files 数组拆分为图片/文件/音频/视频四类
 * - 映射：从 WS/接口 payload 映射附件，支持回退合并
 * - 签名：将 OSS 对象键或相对路径转换为可访问的签名 URL
 * - 校验：前端文件选择的类型与大小校验
 */

/** 允许上传/展示的文件扩展名（用于前端 input accept 与基础校验） */
export const ALLOWED_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'heic',
  'heif',
  'webp',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
  'mp3',
  'wav',
  'aac',
  'm4a',
  'flac',
  'oga',
  'opus',
  'amr',
  'mp4',
  'mov',
  'webm',
  'avi',
  'mkv',
  'm4v',
  'mpeg',
  'mpg',
  'ogg',
];

/** 明确禁止的可执行/压缩等高风险扩展名（优先级高于允许列表） */
export const BLOCKED_EXTENSIONS = [
  'exe',
  'bat',
  'cmd',
  'sh',
  'js',
  'msi',
  'apk',
  'dmg',
  'pkg',
  'iso',
  'bin',
  'com',
  'dll',
  'scr',
  'jar',
  'ps1',
  'vbs',
  '7z',
  'zip',
  'rar',
  // 额外风险类型：常见压缩包与脚本/页面
  'gz',
  'tar',
  'bz2',
  'xz',
  'ipa',
  'deb',
  'rpm',
  'svg',
  'html',
  'htm',
  'php',
  'py',
];

/** 允许的 MIME 类型（与扩展名互为补充，双重校验） */
export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'audio/mpeg',
  'audio/wav',
  'audio/aac',
  'audio/mp4',
  'audio/x-m4a',
  'audio/flac',
  'audio/ogg',
  'audio/webm',
  'audio/3gpp',
  'audio/amr',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
  'video/x-matroska',
  'video/mpeg',
  'video/x-m4v',
  'video/ogg',
];

/** input[type=file] 的 accept 字符串，来源于允许扩展名 */
export const ACCEPT_STRING = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',');

// 统一的最大大小限制（字节）
export const MAX_FILE_SIZE_BYTES = 600 * 1024 * 1024;

/**
 * 前端文件选择校验：
 * - 大小不超过 MAX_FILE_SIZE_BYTES
 * - 扩展名与 MIME 类型必须在允许列表且不在禁止列表
 */
export const validateAttachmentMeta = (
  name: string,
  mime: string,
  size: number,
) => {
  if (size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      reason: `文件大小不能超过 ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`,
    };
  }
  const lower = (name || '').toLowerCase();
  const ext = lower.includes('.') ? lower.split('.').pop() || '' : '';
  const allowedExt = new Set(ALLOWED_EXTENSIONS);
  const blockedExt = new Set(BLOCKED_EXTENSIONS);
  if (!ext || !allowedExt.has(ext) || blockedExt.has(ext)) {
    return { ok: false, reason: '不支持的文件类型' };
  }
  const allowedMimes = new Set(ALLOWED_MIME_TYPES);
  if (mime && !allowedMimes.has(mime)) {
    return { ok: false, reason: '不支持的文件类型' };
  }
  return { ok: true };
};

/**
 * 校验文件是否符合要求
 */
export const validateAttachment = (file: File) => {
  return validateAttachmentMeta(
    file.name || 'file',
    file.type || '',
    file.size,
  );
};

/**
 * 获取视频时长（秒）
 * 案例：
    import { getVideoDurationSeconds } from '@/utils/file/media';

    const d = await getVideoDurationSeconds(file);
    if (d < 15) {
      // 阻止上传或提示
    } else {
      // 继续上传
    }
*/
export async function getVideoDurationSeconds(
  file: File | Blob,
): Promise<number> {
  const isBrowser =
    typeof window !== 'undefined' && typeof document !== 'undefined';
  if (!isBrowser) return 0;
  const url = URL.createObjectURL(file as Blob);
  try {
    return await new Promise<number>((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const cleanup = () => {
        try {
          video.src = '';
        } catch {}
      };
      video.onloadedmetadata = () => {
        const d = Number(video.duration) || 0;
        cleanup();
        resolve(d);
      };
      video.onerror = () => {
        cleanup();
        reject(new Error('metadata error'));
      };
      video.src = url;
    });
  } finally {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }
}
