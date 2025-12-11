var viewer;

function launchViewer(divId, urn, token) {
    console.log("🚀 [JS] launchViewer 호출됨!");
    console.log("   - DIV ID: " + divId);
    console.log("   - Token 길이: " + (token ? token.length : "없음"));

    // 1. 오토데스크 엔진이 로드됐는지 확인
    if (typeof Autodesk === 'undefined') {
        alert("❌ 오토데스크 뷰어 엔진이 로드되지 않았습니다!\nindex.html에 viewer3D.min.js가 있는지 확인하세요.");
        return;
    }

    var htmlDiv = document.getElementById(divId);
    if (!htmlDiv) {
        alert("❌ 뷰어를 띄울 DIV('" + divId + "')를 찾을 수 없습니다!");
        return;
    }

    // 2. 옵션 설정
    var options = {
        'env': 'AutodeskProduction',
        'accessToken': token,
        // URN에 따라 미주/유럽 서버 자동 선택
        'api': 'derivativeV2' + (atob(urn.replace('_', '/').replace('-', '+')).indexOf('~') > -1 ? '_EU' : '')
    };

    // 3. 초기화 시작
    Autodesk.Viewing.Initializer(options, function () {
        console.log("✅ [JS] Autodesk Initializer 성공");

        // 중복 실행 방지 (기존 뷰어 종료)
        if (viewer) {
            try {
                viewer.finish();
                viewer = null;
            } catch (e) { console.warn("기존 뷰어 종료 중 오류:", e); }
        }

        var config = {
            // 1. 확장 프로그램 (기능 추가)
            extensions: [
                'Autodesk.DocumentBrowser',       // 2D/3D 뷰 리스트 (필수)
                'Autodesk.AEC.LevelsExtension',   // 층(Level)별 단면 자르기 패널 (BIM 필수)
                'Autodesk.AEC.Minimap3DExtension',// 3D 미니맵 (좌측 하단)
                'Autodesk.BimWalk',               // 1인칭 보행 모드 (WASD 이동)
                'Autodesk.Hyperlink'              // 2D 도면에서 단면 기호 누르면 3D로 이동
            ],

            // 2. 테마 설정 (취향따라 선택)
            // 'dark-theme' (기본값: 검은색/차콜) 
            // 'light-theme' (밝은 회색, BIM 360 스타일)
            theme: 'dark-theme',

            // 3. 뷰어 프로필 설정 (기본값 추천)
            profileSettings: {
                // 그리드 끄고 싶으면 false
                enableGrid: true,
                // 그림자 끄고 싶으면 false (성능 향상)
                enableShadows: true
            }
        };

        // 설정 적용해서 뷰어 생성
        viewer = new Autodesk.Viewing.GuiViewer3D(htmlDiv, config);

        var startedCode = viewer.start();
        if (startedCode > 0) {
            console.error('❌ Viewer 시작 실패. WebGL 에러일 수 있음. 코드:', startedCode);
            return;
        }

        console.log('✅ Viewer 시작됨. 모델 로드 시도...');

        var documentId = 'urn:' + urn;
        Autodesk.Viewing.Document.load(documentId, onDocumentLoadSuccess, onDocumentLoadFailure);
    });
}

function onDocumentLoadSuccess(doc) {
    console.log('✅ 문서 로드 성공. 지오메트리 탐색 중...');
    var viewables = doc.getRoot().getDefaultGeometry();

    if (!viewables) {
        console.warn('⚠️ 기본 3D 뷰가 없습니다. 전체 탐색 시도...');
        var allViewables = doc.getRoot().search({ 'type': 'geometry' });
        if (allViewables && allViewables.length > 0) {
            viewables = allViewables[0];
        } else {
            console.error('❌ 표시할 뷰가 하나도 없습니다. Revit 게시 설정 확인 필요.');
            return;
        }
    }

    viewer.loadDocumentNode(doc, viewables).then(i => {
        console.log('🎉 모델 로드 및 렌더링 완료!');
        // 모델 로드 후 딱 맞게 줌인
        viewer.fitToView();
        viewer.navigation.setReverseZoomDirection(true);
    });
}

function onDocumentLoadFailure(viewerErrorCode, viewerErrorMsg) {
    console.error('❌ 문서 로드 실패. ErrorCode: ' + viewerErrorCode + ' Msg: ' + viewerErrorMsg);
}

// 창 크기 변경 시 뷰어 리사이즈
window.addEventListener('resize', function () {
    if (viewer) {
        viewer.resize();
    }
});