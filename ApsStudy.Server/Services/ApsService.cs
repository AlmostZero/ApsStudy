using Autodesk.Authentication;
using Autodesk.Authentication.Model;
using Autodesk.Oss;              // [형님 정답] 대소문자 수정 (Oss)
using Autodesk.Oss.Model;        // [형님 정답] 대소문자 수정 (Oss.Model)
using Autodesk.SDKManager;       // [형님 정답] 대소문자 수정 (SDKManager)

namespace ApsStudy.Server.Services
{
    public class ApsService : IApsService
    {
        private readonly IConfiguration _configuration;
        private readonly AuthenticationClient _authClient;
        private readonly OssClient _ossClient;

        private string _cachedToken = string.Empty;
        private DateTime _tokenExpiry = DateTime.MinValue;

        public ApsService( IConfiguration configuration )
        {
            _configuration = configuration;

            // [수정] SdkManagerBuilder 대소문자 주의
            var sdkManager = SdkManagerBuilder.Create().Build();

            _authClient = new AuthenticationClient( sdkManager );
            _ossClient = new OssClient( sdkManager );
        }

        public async Task<string> GetAccessToken()
        {
            if ( !string.IsNullOrEmpty( _cachedToken ) && _tokenExpiry > DateTime.UtcNow.AddMinutes( 5 ) )
            {
                return _cachedToken;
            }

            var clientId = _configuration[ "Aps:ClientId" ];
            var clientSecret = _configuration[ "Aps:ClientSecret" ];

            var twoLeggedToken = await _authClient.GetTwoLeggedTokenAsync(
                clientId,
                clientSecret,
                new List<Scopes> { Scopes.DataRead, Scopes.DataWrite, Scopes.BucketCreate, Scopes.BucketRead }
            );

            _cachedToken = twoLeggedToken.AccessToken;
            _tokenExpiry = DateTime.UtcNow.AddSeconds( (double)twoLeggedToken.ExpiresIn );

            return _cachedToken;
        }

        public async Task<string> EnsureBucketExists()
        {
            var token = await GetAccessToken();
            var bucketKey = _configuration[ "Aps:BucketKey" ];

            try
            {
                // 1. 버킷 조회 (순서: bucketKey, accessToken)
                await _ossClient.GetBucketDetailsAsync( bucketKey, accessToken: token );
                return bucketKey; // 있으면 리턴
            }
            catch ( Autodesk.Oss.OssApiException e ) // [수정] OssApiException
            {
                // 404 Not Found: 없으니까 만듦
                if ( e.HttpResponseMessage.StatusCode == System.Net.HttpStatusCode.NotFound )
                {
                    var payload = new CreateBucketsPayload
                    {
                        BucketKey = bucketKey,
                        PolicyKey = PolicyKey.Transient // 24시간 후 삭제
                    };

                    try
                    {
                        // 2. 버킷 생성 (순서: Region, Payload, Token)
                        // 형님 툴팁에서 확인한 그 순서!
                        await _ossClient.CreateBucketAsync( Region.US, payload, token );
                        return bucketKey;
                    }
                    catch ( Autodesk.Oss.OssApiException createEx )
                    {
                        // 409 Conflict: 이름 중복
                        if ( createEx.HttpResponseMessage.StatusCode == System.Net.HttpStatusCode.Conflict )
                        {
                            throw new Exception( $"형님! 버킷 이름 '{bucketKey}'는 이미 누가 쓰고 있습니다. appsettings.json 가서 바꾸십쇼." );
                        }
                        throw new Exception( $"버킷 생성 실패: {createEx.Message}" );
                    }
                }
                throw e;
            }
        }

        public async Task<string> UploadFileToBucket( string fileName, Stream fileStream )
        {
            // 1. "야, 버킷 있냐? 없으면 만들어라." (여기서 사용됨!)
            var bucketKey = await EnsureBucketExists();
            var token = await GetAccessToken();

            try
            {
                // 2. 오토데스크 버킷으로 파일 발사!
                // UploadObjectAsync(버킷키, 파일이름, 스트림, 토큰)
                // 신형 SDK에서는 결과로 'ObjectDetails'를 줍니다.
                var result = await _ossClient.UploadObjectAsync( bucketKey, fileName, fileStream, accessToken: token );

                // 3. 결과물 중 'ObjectId' (urn:adsk.objects:os.object:...)가 중요함!
                // 나중에 이거 가지고 "변환해라" 명령 내려야 함.
                return result.ObjectId;
            }
            catch ( Autodesk.Oss.OssApiException e )
            {
                throw new Exception( $"OSS 업로드 실패: {e.Message}" );
            }
        }

        // [추가] 버킷 내부 파일 목록 조회
        public async Task<List<ObjectDetails>> GetBucketObjects()
        {
            // 1. 버킷이 없으면 에러 나니까 확인 먼저
            var bucketKey = await EnsureBucketExists();
            var token = await GetAccessToken();

            try
            {
                // 2. 목록 조회 (최대 100개까지 가져옴)
                // limit: 가져올 개수 (기본값 10, 최대 100)
                var response = await _ossClient.GetObjectsAsync( bucketKey, limit: 100, accessToken: token );

                // 3. 아이템 리스트 반환 (없으면 빈 리스트)
                return response.Items ?? new List<ObjectDetails>();
            }
            catch ( Autodesk.Oss.OssApiException e )
            {
                throw new Exception( $"재고 조사 실패: {e.Message}" );
            }
        }
    }
}