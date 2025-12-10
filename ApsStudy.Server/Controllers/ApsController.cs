using Microsoft.AspNetCore.Mvc;
using ApsStudy.Server.Services; // 주방장(Service) 부르기 위해 필요
using ApsStudy.Shared.DTOs;     // 영수증(DTO) 쓰기 위해 필요

namespace ApsStudy.Server.Controllers
{

    // https://localhost:7107/api/aps/token
    [Route( "api/[controller]" )]
    [ApiController]
    public class ApsController : ControllerBase
    {
        // 1. 주방장(Service) 선언
        private readonly IApsService _apsService;

        // 2. 생성자 주입 (DI)
        // "야 닷넷아, ApsController 만들 때 IApsService도 같이 꽂아줘라"
        public ApsController( IApsService apsService )
        {
            _apsService = apsService;
        }

        [HttpGet( "token" )]
        public async Task<IActionResult> GetToken()
        {
            try
            {
                // 주방장한테 "야, 오토데스크 토큰 좀 받아와" 시킴
                var token = await _apsService.GetAccessToken();

                // 형님, 토큰만 달랑 주면 심심하니까 JSON으로 포장해서 줍니다.
                return Ok( new { AccessToken = token } );
            }
            catch ( Exception ex )
            {
                return BadRequest( $"토큰 발급 실패 시발: {ex.Message}" );
            }
        }

        // [기존 코드 수정] GET /api/aps/bucket
        // 이제는 파일 목록을 보여줍니다.
        [HttpGet( "bucket" )]
        public async Task<IActionResult> GetBucketFiles()
        {
            try
            {
                // 1. 서비스에서 파일 목록 가져옴
                var objects = await _apsService.GetBucketObjects();

                // 2. 보기 좋게 가공 (Projection)
                var result = objects.Select( o => new
                {
                    FileName = o.ObjectKey,  // 파일 이름 (image.png, model.rvt)
                    Size = o.Size,           // 파일 크기
                    ObjectId = o.ObjectId,   // 원본 ID (urn:adsk.objects:...)

                    // [핵심] 뷰어에서 쓸 URN (Base64 인코딩)
                    // 뷰어는 ObjectId를 Base64로 바꾼 걸 "urn"이라고 부름
                    Urn = ToBase64( o.ObjectId )
                } );

                return Ok( result );
            }
            catch ( Exception ex )
            {
                return BadRequest( $"목록 조회 실패: {ex.Message}" );
            }
        }

        // [헬퍼 함수] 문자열 -> Base64 변환 (뷰어용)
        private string ToBase64( string input )
        {
            var bytes = System.Text.Encoding.UTF8.GetBytes( input );
            return Convert.ToBase64String( bytes ).TrimEnd( '=' ); // 뷰어 스펙상 뒤에 '=' 패딩은 떼는 게 국룰
        }



        [HttpPost( "upload" )]
        [RequestSizeLimit( 100 * 1024 * 1024 )]
        [RequestFormLimits( MultipartBodyLengthLimit = 100 * 1024 * 1024 )]
        public async Task<IActionResult> UploadModel( IFormFile file )
        {
            if ( file == null || file.Length == 0 ) return BadRequest( "파일 없음" );

            // 확장자 검사
            var ext = Path.GetExtension( file.FileName ).ToLower();
            if ( ext != ".rvt" ) return BadRequest( "Revit(.rvt) 파일만 받습니다." );

            try
            {
                // 1. 로컬 저장 (백업용으로 유지)
                var uploadPath = Path.Combine( Directory.GetCurrentDirectory(), "Uploads" );
                if ( !Directory.Exists( uploadPath ) ) Directory.CreateDirectory( uploadPath );

                var fileName = $"{Path.GetFileNameWithoutExtension( file.FileName )}_{Guid.NewGuid()}{ext}";
                var fullPath = Path.Combine( uploadPath, fileName );

                using ( var stream = new FileStream( fullPath, FileMode.Create ) )
                {
                    await file.CopyToAsync( stream );
                }

                // ==========================================
                // [추가된 부분] 2. 오토데스크 버킷으로 업로드
                // ==========================================
                string objectId = "";

                // 방금 저장한 파일을 다시 읽어서 오토데스크로 쏨
                using ( var readStream = new FileStream( fullPath, FileMode.Open, FileAccess.Read ) )
                {
                    // 주방장 호출! (여기서 내부적으로 EnsureBucketExists가 돕니다)
                    objectId = await _apsService.UploadFileToBucket( fileName, readStream );
                }

                // 3. 결과 리턴 (ObjectId를 클라이언트한테 알려줌)
                return Ok( new UploadResponseDto
                {
                    IsSuccess = true,
                    // 메시지에 ObjectId 슬쩍 포함시킴 (나중에 쓸 거임)
                    Message = "로컬 저장 & 버킷 업로드 완료!",
                    StoredFileName = objectId // 이제 파일명 대신 ObjectId를 줌
                } );
            }
            catch ( Exception ex )
            {
                return StatusCode( 500, $"작업 실패: {ex.Message}" );
            }
        }


    }
}