import { customInstance } from './axios-instance';
import type { ApiResponseCvUploadResponse } from './generated/user/model';

export function uploadCvFile(file: File) {
  const form = new FormData();
  form.append('file', file);
  // Omit Content-Type so Axios sets it automatically with the correct multipart boundary
  return customInstance<ApiResponseCvUploadResponse>({
    url: '/api/candidates/cv/upload',
    method: 'POST',
    data: form,
  });
}
