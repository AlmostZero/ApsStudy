using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ApsStudy.Shared.DTOs
{
    public class UploadResponseDto
    {
        public bool IsSuccess { get; set; }
        public string Message { get; set; } = string.Empty;
        public string StoredFileName { get; set; } = string.Empty; // 서버에 저장된 이름
    }
}
