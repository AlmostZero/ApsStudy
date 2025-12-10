using System.Text.Json.Serialization;

namespace ApsStudy.Server.Models
{
    
    // 오토데스크가 던져주는 JSON 형태 그대로 만든 클래스
    public class ApsTokenResponse
    {
        [JsonPropertyName( "access_token" )]
        public string AccessToken { get; set; } = string.Empty;

        [JsonPropertyName( "expires_in" )]
        public int ExpiresIn { get; set; } // 유효기간 (보통 3599초)

        [JsonPropertyName( "token_type" )]
        public string TokenType { get; set; } = string.Empty;
    }

}
