using Autodesk.ModelDerivative.Model;

namespace ApsStudy.Server.Services
{
    public interface IDerivativeService
    {
        // 1. 변환 요청
        Task<string> TranslateModel( string objectId );

        // 2. 상태 확인 (문자열 리턴)
        Task<string> GetTranslationStatus( string urn );

        // [추가] 3. 상세 부검표(Manifest) 통째로 가져오기 👈 이거 추가!
        Task<Autodesk.ModelDerivative.Model.Manifest> GetManifest( string urn );
    }
}
