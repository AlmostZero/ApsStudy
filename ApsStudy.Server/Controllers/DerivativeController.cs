using Microsoft.AspNetCore.Mvc;
using ApsStudy.Server.Services;

namespace ApsStudy.Server.Controllers
{
    [Route( "api/[controller]" )] // 주소: /api/derivative
    [ApiController]
    public class DerivativeController : ControllerBase
    {
        private readonly IDerivativeService _derivativeService;

        // 뷰어 전문 요리사 주입
        public DerivativeController( IDerivativeService derivativeService )
        {
            _derivativeService = derivativeService;
        }

        // [POST] /api/derivative/translate
        [HttpPost( "translate" )]
        public async Task<IActionResult> Translate( [FromBody] string objectId )
        {
            try
            {
                // 전문 요리사한테 토스
                var result = await _derivativeService.TranslateModel( objectId );
                return Ok( new { Message = "변환 작업 시작됨!", JobStatus = result } );
            }
            catch ( Exception ex )
            {
                return BadRequest( $"변환 요청 실패: {ex.Message}" );
            }
        }

        // [추가] GET /api/derivative/status?objectId=...
        // 쿼리 스트링으로 objectId를 받습니다. (URL에 포함하기엔 특수문자가 많아서)
        [HttpGet( "status" )]
        public async Task<IActionResult> GetStatus( [FromQuery] string urn )
        {
            try
            {
                // 서비스 인터페이스도 string urn으로 받는 게 맞음
                var status = await _derivativeService.GetTranslationStatus( urn );
                return Ok( new { Status = status } );
            }
            catch ( Exception ex )
            {
                return BadRequest( $"상태 확인 실패: {ex.Message}" );
            }
        }

        // [추가] GET /api/derivative/manifest?urn=...
        [HttpGet( "manifest" )]
        public async Task<IActionResult> GetManifest( [FromQuery] string urn )
        {
            try
            {
                var manifest = await _derivativeService.GetManifest( urn );
                return Ok( manifest ); // JSON으로 쫙 펴서 보냄
            }
            catch ( Exception ex )
            {
                return BadRequest( $"상세 조회 실패: {ex.Message}" );
            }
        }

    }
}