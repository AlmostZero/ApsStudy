using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ApsStudy.Shared.DTOs
{
    public class BucketObjectDto
    {
        public string FileName { get; set; }
        public string ObjectId { get; set; }
        public string Urn { get; set; }

        // [중요] 이건 UI에서 쓸 거라 서버는 몰라도 되지만, 
        // 클라이언트 편의를 위해 여기 넣어두면 편합니다.
        // (서버에서 내려줄 땐 null이나 기본값이었다가 클라이언트가 채웁니다.)
        public string TranslationStatus { get; set; } = "checking";
    }
}
