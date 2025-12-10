using Autodesk.Oss.Model;

namespace ApsStudy.Server.Services
{
    public interface IApsService
    {
        // "토큰 내놔" 하면 토큰 문자열(String)만 딱 리턴하는 기능
        Task<string> GetAccessToken();

        Task<string> EnsureBucketExists();

        // [추가] 파일을 받아서 버킷에 올리고, '고유 ID(ObjectId)'를 뱉는 기능
        Task<string> UploadFileToBucket( string fileName, Stream fileStream );

        Task<List<ObjectDetails>> GetBucketObjects();

    }
}
