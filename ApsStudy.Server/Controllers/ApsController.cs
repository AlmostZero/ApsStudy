using Microsoft.AspNetCore.Mvc;
using ApsStudy.Server.Services; // 주방장(Service) 부르기 위해 필요
using ApsStudy.Shared.DTOs;
using Autodesk.Oss.Model;     // 영수증(DTO) 쓰기 위해 필요

namespace ApsStudy.Server.Controllers
{

    // https://localhost:7107/api/aps/token
    [Route( "api/[controller]" )]
    [ApiController]
    public class ApsController : ControllerBase
    {
        // 1. 주방장(Service) 선언
        private readonly IApsService _apsService;
        private readonly IDerivativeService _derivativeService; // [추가] 변환 요리사

        // 2. 생성자 주입 (DI)
        // "야 닷넷아, ApsController 만들 때 IApsService도 같이 꽂아줘라"
        public ApsController( IApsService apsService, 
                              IDerivativeService derivativeService )
        {
            _apsService = apsService;
            _derivativeService = derivativeService;
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
                var objects = await _apsService.GetBucketObjects();

                // [수정] 익명 객체 대신 BucketObjectDto 사용
                var result = objects.Select( o => new BucketObjectDto
                {
                    FileName = o.ObjectKey,
                    // Size는 DTO에 안 넣었으니 뺍니다 (필요하면 DTO에 추가하세요)
                    ObjectId = o.ObjectId,
                    Urn = ToBase64( o.ObjectId ),
                    TranslationStatus = "n/a" // 초기값
                } );

                return Ok( result );
            }
            catch ( Exception ex )
            {
                return BadRequest( $"목록 조회 실패: {ex.Message}" );
            }
        }

        // [유지] 삭제 기능은 형님이 필요하다고 하셨으니 남겨둡니다!
        [HttpDelete( "bucket/{objectName}" )]
        public async Task<IActionResult> DeleteFile( string objectName )
        {
            try
            {
                await _apsService.DeleteFile( objectName );
                return Ok( new { Message = $"'{objectName}' 삭제 완료." } );
            }
            catch ( Exception ex )
            {
                return BadRequest( $"삭제 실패: {ex.Message}" );
            }
        }

        // [헬퍼 함수] 문자열 -> Base64 변환 (뷰어용)
        private string ToBase64( string input )
        {
            var bytes = System.Text.Encoding.UTF8.GetBytes( input );
            return Convert.ToBase64String( bytes )
                .TrimEnd( '=' )      // 패딩 제거
                .Replace( '+', '-' ) // 더하기(+) -> 빼기(-)
                .Replace( '/', '_' ); // 슬래시(/) -> 언더바(_) 👈 이게 핵심!
        }



        [HttpPost( "upload" )]
        [RequestSizeLimit( 100 * 1024 * 1024 )]
        public async Task<IActionResult> UploadModel( IFormFile file )
        {
            if ( file == null || file.Length == 0 ) return BadRequest( "파일 없음" );
            var ext = Path.GetExtension( file.FileName ).ToLower();
            if ( ext != ".rvt" ) return BadRequest( "Revit(.rvt) 파일만 받습니다." );

            try
            {
                // 1. 로컬 저장 (기존 코드 유지)
                var uploadPath = Path.Combine( Directory.GetCurrentDirectory(), "Uploads" );
                if ( !Directory.Exists( uploadPath ) ) Directory.CreateDirectory( uploadPath );
                var fileName = $"{Path.GetFileNameWithoutExtension( file.FileName )}_{Guid.NewGuid()}{ext}";
                var fullPath = Path.Combine( uploadPath, fileName );
                using ( var stream = new FileStream( fullPath, FileMode.Create ) ) { await file.CopyToAsync( stream ); }

                // 2. 버킷 업로드 (ObjectId 받음)
                string objectId = "";
                using ( var readStream = new FileStream( fullPath, FileMode.Open, FileAccess.Read ) )
                {
                    objectId = await _apsService.UploadFileToBucket( fileName, readStream );
                }

                // ==========================================
                // 3. 업로드 끝나자마자 바로 변환 돌려버리기!
                // ==========================================
                string jobResult = "Not Started";
                try
                {
                    // 변환 요청 시도
                    jobResult = await _derivativeService.TranslateModel( objectId );
                }
                catch ( Exception ex )
                {
                    // [수정] 에러를 그냥 삼키지 말고, 변수에 담아서 형님한테 보고합니다.
                    jobResult = $"Error: {ex.Message}";

                    // 콘솔에도 빨간 줄로 찍어버립니다.
                    Console.WriteLine( $"변환 요청 실패! 이유: {ex.Message}" );
                }

                // 4. 결과 리턴 (메시지에 변환 결과도 같이 포함시킴)
                return Ok( new UploadResponseDto
                {
                    IsSuccess = true,
                    // 메시지에 jobResult를 포함시켜서 Postman에서 바로 확인 가능하게 함
                    Message = $"업로드 완료! 자동 변환 요청 결과: [{jobResult}]",
                    StoredFileName = objectId
                } );
            }
            catch ( Exception ex )
            {
                return StatusCode( 500, $"작업 실패: {ex.Message}" );
            }
        }


    }
}