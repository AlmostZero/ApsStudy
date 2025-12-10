using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ApsStudy.Shared.DTOs
{
    public class ApsWallDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty; // 벽 이름
        public double Area { get; set; } // 면적
        public bool IsExternal { get; set; } // 외벽 여부
    }
}
