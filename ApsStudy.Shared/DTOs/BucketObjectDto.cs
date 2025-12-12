using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ApsStudy.Shared.DTOs
{
    public class BucketObjectDto
    {
        public string ObjectId { get; set; } = string.Empty;
        public string Urn { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;

        // [추가] 파일 크기 (바이트 단위)
        public long Size { get; set; }

        // [추가] 업로드 날짜 (문자열로 받음)
        public string UploadedDate { get; set; } = string.Empty;

        public string TranslationStatus { get; set; } = "n/a";
    }
}
