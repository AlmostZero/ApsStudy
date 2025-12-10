
using ApsStudy.Server.Services;

namespace ApsStudy.Server
{
    public class Program
    {
        public static void Main( string[] args )
        {
            var builder = WebApplication.CreateBuilder( args );

            // Add services to the container.

            builder.Services.AddControllers();
            // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen();

            builder.Services.AddCors( options => options.AddPolicy( "AllowAll", p => p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader() ) );

            // [추가] 3. Kestrel 서버 자체의 최대 전송 크기 제한 해제 (100MB)
            builder.WebHost.ConfigureKestrel( options =>
            {
                // null로 설정하면 제한 없음 (또는 숫자로 100 * 1024 * 1024 지정 가능)
                options.Limits.MaxRequestBodySize = 100 * 1024 * 1024;
            } );

            // [추가] 4. 폼 옵션 제한 해제 (이게 있어야 Multipart 전송 때 안 막힘)
            builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>( options =>
            {
                options.MultipartBodyLengthLimit = 100 * 1024 * 1024; // 100MB
            } );

            builder.Services.AddScoped<IApsService, ApsService>();

            var app = builder.Build();

            // Configure the HTTP request pipeline.
            if ( app.Environment.IsDevelopment() )
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            app.UseCors( "AllowAll" );

            

            app.UseHttpsRedirection();
            app.UseAuthorization();
            app.MapControllers();
            app.Run();
        }
    }
}
