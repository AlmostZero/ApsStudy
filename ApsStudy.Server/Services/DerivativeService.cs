using Autodesk.ModelDerivative;
using Autodesk.ModelDerivative.Model; // IJobPayloadFormat, JobPayloadFormatSVF2 등
using Autodesk.SDKManager;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace ApsStudy.Server.Services
{
    public class DerivativeService : IDerivativeService
    {
        private readonly IApsService _apsService;
        private readonly ModelDerivativeClient _derivativeClient;

        public DerivativeService( IApsService apsService )
        {
            _apsService = apsService;
            var sdkManager = SdkManagerBuilder.Create().Build();
            _derivativeClient = new ModelDerivativeClient( sdkManager );
        }

        public async Task<string> TranslateModel( string objectId )
        {
            var token = await _apsService.GetAccessToken();
            var urn = Base64Encode( objectId );

            var payload = new JobPayload
            {
                Input = new JobPayloadInput
                {
                    Urn = urn
                    // [삭제] .rvt 파일일 때는 아래 두 줄 절대 넣지 마십쇼!
                    // RootFilename = "...", 
                    // CompressedUrn = true 
                },
                Output = new JobPayloadOutput
                {
                    Formats = new List<IJobPayloadFormat>
                    {
                        new JobPayloadFormatSVF2
                        {
                            Views = new List<View> { View._2d, View._3d },
                        }
                    }
                }
            };

            try
            {
                // [수정] 파라미터는 이렇게 명확하게
                var job = await _derivativeClient.StartJobAsync( jobPayload: payload, region: Region.US, accessToken: token );
                return job.Result.ToString(); // "Created" or "Success"
            }
            catch ( Autodesk.ModelDerivative.ModelDerivativeApiException e )
            {
                throw new Exception( $"변환 요청 실패: {e.Message}" );
            }
        }

        // [중요] 상태 조회는 URN을 받는 게 제일 안전함 (컨트롤러에서 수정 필요할 수 있음)
        // 일단 형님 코드 구조 유지하려고 ObjectId 받는 걸로 둡니다.
        public async Task<string> GetTranslationStatus( string urn )
        {
            var token = await _apsService.GetAccessToken();

            try
            {
                var manifest = await _derivativeClient.GetManifestAsync( urn, accessToken: token );
                return manifest.Status.ToString();
            }
            catch ( Autodesk.ModelDerivative.ModelDerivativeApiException e )
            {
                if ( e.HttpResponseMessage.StatusCode == System.Net.HttpStatusCode.NotFound )
                {
                    return "n/a";
                }
                throw;
            }
        }

        // [추가] 상세 Manifest 조회
        public async Task<Autodesk.ModelDerivative.Model.Manifest> GetManifest( string urn )
        {
            var token = await _apsService.GetAccessToken();
            // 주의: 이미 URN 상태로 들어오므로 Base64Encode 안 함!

            try
            {
                return await _derivativeClient.GetManifestAsync( urn, accessToken: token );
            }
            catch ( Autodesk.ModelDerivative.ModelDerivativeApiException e )
            {
                throw new Exception( $"Manifest 조회 실패: {e.Message}" );
            }
        }

        // [추가] 실패 원인(메시지)까지 다 긁어오는 탐정 함수
        public async Task<string> GetManifestDetails( string objectId )
        {
            var token = await _apsService.GetAccessToken();
            // 아까 수정한 완벽한 Base64Encode 사용 필수!
            var urn = Base64Encode( objectId );

            try
            {
                var manifest = await _derivativeClient.GetManifestAsync( urn, accessToken: token );

                // 형님 보기 좋게 JSON으로 싹 다 뱉어줍니다.
                // 여기 안에 "messages" 라는 배열을 보면 범인이 적혀 있습니다.
                return manifest.ToString();
            }
            catch ( Exception ex )
            {
                return $"에러: {ex.Message}";
            }
        }

        // [초중요] 일본어 파일 살리는 코드 (제발 빼지 마십쇼 형님 ㅠㅠ)
        public static string Base64Encode( string plainText )
        {
            var plainTextBytes = System.Text.Encoding.UTF8.GetBytes( plainText );
            return System.Convert.ToBase64String( plainTextBytes )
                .TrimEnd( '=' )      // 패딩 제거
                .Replace( '+', '-' ) // [복구] URL Safe 처리 1
                .Replace( '/', '_' ); // [복구] URL Safe 처리 2
        }
    }
}