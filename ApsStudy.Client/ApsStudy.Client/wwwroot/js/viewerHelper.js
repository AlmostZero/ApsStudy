// 전역 변수 2개 선언
var viewer2D; // 왼쪽
var viewer3D; // 오른쪽
var isSyncing = false; // [핵심] 무한 루프 방지용 락(Lock)

// [메인 함수] 2D/3D 뷰어 동시 실행
function launchDualViewer(div2dId, div3dId, urn, token) {
    console.log("🚀 [JS] 듀얼 뷰어 시작!");

    if (typeof Autodesk === 'undefined') {
        alert("❌ 뷰어 엔진 로드 안됨!");
        return;
    }

    var options = {
        'env': 'AutodeskProduction',
        'accessToken': token,
        'api': 'derivativeV2' + (atob(urn.replace('_', '/').replace('-', '+')).indexOf('~') > -1 ? '_EU' : '')
    };

    Autodesk.Viewing.Initializer(options, function () {
        console.log("✅ Initializer 성공");

        // 1. 기존 뷰어들 정리 (메모리 누수 방지)
        if (viewer2D) { viewer2D.finish(); viewer2D = null; }
        if (viewer3D) { viewer3D.finish(); viewer3D = null; }

        // 2. 뷰어 각각 생성
        var div2d = document.getElementById(div2dId);
        var div3d = document.getElementById(div3dId);

        // [설정] 2D용은 가볍게, 3D용은 풀옵션으로
        viewer2D = new Autodesk.Viewing.GuiViewer3D(div2d, { extensions: ['Autodesk.DocumentBrowser'] });

        var config3D = {
            extensions: [
                'Autodesk.DocumentBrowser', 'Autodesk.AEC.LevelsExtension',
                'Autodesk.AEC.Minimap3DExtension', 'Autodesk.BimWalk',
                'Autodesk.FullScreen'
            ],
            theme: 'dark-theme',
            profileSettings: { enableGrid: true, enableShadows: true }
        };
        viewer3D = new Autodesk.Viewing.GuiViewer3D(div3d, config3D);

        // 3. 둘 다 Start
        viewer2D.start();
        viewer3D.start();

        // =======================================================
        // [신규] 두 뷰어 간의 선택 동기화 (영혼의 파트너 맺기)
        // =======================================================
        setupDualSelectionSync(viewer2D, viewer3D);

        // 4. 문서 로드 (하나의 URN을 두 뷰어가 공유)
        var documentId = 'urn:' + urn;
        Autodesk.Viewing.Document.load(documentId, onDualDocumentLoadSuccess, onDocumentLoadFailure);
    });
}

// 문서 로드 성공 시 -> 2D/3D 분배 로직
function onDualDocumentLoadSuccess(doc) {
    console.log('✅ 문서 로드 성공. 뷰 분배 시작...');

    // 1. 2D 뷰(Sheet) 찾기
    var items2d = doc.getRoot().search({ 'type': 'geometry', 'role': '2d' });

    // 2. 3D 뷰(Model) 찾기
    var items3d = doc.getRoot().search({ 'type': 'geometry', 'role': '3d' });

    // --- [왼쪽 2D 뷰어 로드] ---
    if (items2d && items2d.length > 0) {
        viewer2D.loadDocumentNode(doc, items2d[0]).then(i => {
            console.log('📄 2D 뷰 로드 완료');
            viewer2D.fitToView();
        });
    } else {
        console.warn("⚠️ 이 파일엔 2D 시트가 없습니다.");
    }

    // --- [오른쪽 3D 뷰어 로드] ---
    if (items3d && items3d.length > 0) {
        viewer3D.loadDocumentNode(doc, items3d[0]).then(i => {
            console.log('🧊 3D 뷰 로드 완료');

            // 형님의 3D 풀옵션 설정 적용
            viewer3D.fitToView();
            viewer3D.navigation.setReverseZoomDirection(true);
            viewer3D.setDisplayEdges(true);
            viewer3D.setLightPreset(6);
            viewer3D.setQualityLevel(true, true);
            viewer3D.setGroundShadow(true);
            viewer3D.setEnvMapBackground(false);

            // 아까 만든 자동 숨김 기능 (3D에만 적용)
            applyAutoHiding(viewer3D);
        });
    } else {
        console.error("❌ 3D 뷰가 없습니다.");
    }
}

function onDocumentLoadFailure(code, msg) {
    console.error('❌ 로드 실패: ' + code + ' / ' + msg);
}

// 리사이즈 대응
window.addEventListener('resize', function () {
    if (viewer2D) viewer2D.resize();
    if (viewer3D) viewer3D.resize();
});


// -------------------------------------------------------------
// [핵심 기능 수정] 2D <-> 3D 양방향 선택 + 줌인(Fit) 동기화
// -------------------------------------------------------------
function setupDualSelectionSync(viewer2D, viewer3D) {
    if (!viewer2D || !viewer3D) return;

    // 2D에서 선택 -> 3D 선택 및 줌인
    viewer2D.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, function (event) {
        if (isSyncing) return;

        isSyncing = true; // 락 걸기

        // 1. 3D에서도 똑같은 놈 선택
        viewer3D.select(event.dbIdArray);

        // 2. [추가] 선택한 놈이 있으면 거기로 카메라 슝~ 이동 (Fit To View)
        if (event.dbIdArray.length > 0) {
            viewer3D.fitToView(event.dbIdArray);
        }

        isSyncing = false; // 락 풀기
    });

    // 3D에서 선택 -> 2D 선택 및 줌인
    viewer3D.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, function (event) {
        if (isSyncing) return;

        isSyncing = true;

        // 1. 2D에서도 똑같은 놈 선택
        viewer2D.select(event.dbIdArray);

        // 2. [추가] 2D 도면에서도 그 부재 위치로 줌인
        if (event.dbIdArray.length > 0) {
            viewer2D.fitToView(event.dbIdArray);
        }

        isSyncing = false;
    });

    console.log("🔗 [Sync] 뷰어 동기화 (Zoom 포함) 연결 완료");
}


// [자동 숨김 로직]
function applyAutoHiding(viewerInstance) {
    if (!viewerInstance) return;

    if (viewerInstance.model.isObjectTreeLoaded()) {
        executeHideLogic(viewerInstance);
    } else {
        console.log("⏳ [Auto-Hide] 속성 데이터 로딩 대기 중...");
        viewerInstance.addEventListener(Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, function () {
            console.log("✅ [Auto-Hide] 속성 데이터 로드 완료! 수색 시작.");
            executeHideLogic(viewerInstance);
        });
    }
}

// [숨김 실행]
function executeHideLogic(viewerInstance) {
    console.log("🕵️‍♂️ [Step 1] 'Direct Shape' 카테고리 수색 시작...");

    viewerInstance.search('Direct Shape', function (dbIds) {

        if (dbIds.length === 0) {
            console.warn("⚠️ [Fail] 'Direct Shape' 검색 결과 0개.");
            retrySearchDummy(viewerInstance);
            return;
        }

        console.log("🔎 [Step 2] 1차 후보 발견: " + dbIds.length + "개. 'formwork_dummy' 선별 작업 시작...");

        viewerInstance.model.getBulkProperties(dbIds, ['Type Name'], function (results) {

            var killList = [];

            results.forEach(function (item) {
                var typeProp = item.properties.find(p => p.displayName === 'Type Name');
                if (typeProp && typeProp.displayValue === 'formwork_dummy') {
                    killList.push(item.dbId);
                }
            });

            if (killList.length > 0) {
                console.log("🚫 [Step 3] 최종 제거 완료: " + killList.length + "개");
                viewerInstance.hide(killList);
            } else {
                console.log("✅ [Pass] 'Direct Shape'는 맞는데 'formwork_dummy'가 아님.");
            }
        });

    }, function (err) {
        console.error("검색 에러:", err);
    }, ['Name']);
}

// [비상 대책]
function retrySearchDummy(viewerInstance) {
    console.log("🔄 [Retry] 'formwork_dummy' 텍스트로 전체 검색 시도...");

    viewerInstance.search('formwork_dummy', function (dbIds) {
        if (dbIds.length > 0) {
            console.log("🚫 [Retry Success] 'formwork_dummy' 발견 및 제거: " + dbIds.length + "개");
            viewerInstance.hide(dbIds);
        } else {
            console.error("❌ [Final Fail] 진짜 못 찾겠음.");
        }
    }, null, ['Type Name']);
}


// [신규] 드래그 리사이즈 기능 활성화 함수
function enableResizer(leftId, rightId, gutterId) {
    const left = document.getElementById(leftId);
    const right = document.getElementById(rightId);
    const gutter = document.getElementById(gutterId);
    const container = left.parentElement; // 부모 컨테이너

    if (!left || !right || !gutter || !container) return;

    let isDragging = false;

    // 1. 드래그 시작
    gutter.addEventListener('mousedown', function (e) {
        isDragging = true;
        document.body.style.cursor = 'col-resize'; // 전체 커서 변경
        e.preventDefault(); // 텍스트 선택 방지
    });

    // 2. 드래그 중 (마우스 이동)
    document.addEventListener('mousemove', function (e) {
        if (!isDragging) return;

        // 전체 너비 대비 마우스 위치 비율 계산 (%)
        // container.getBoundingClientRect().left 는 컨테이너의 시작점
        let containerRect = container.getBoundingClientRect();
        let mouseX = e.clientX - containerRect.left;
        let totalWidth = containerRect.width;

        // 최소/최대 너비 제한 (10% ~ 90%)
        let percentage = (mouseX / totalWidth) * 100;
        if (percentage < 10) percentage = 10;
        if (percentage > 90) percentage = 90;

        // 왼쪽 뷰어 너비 적용
        left.style.width = `${percentage}%`;
        // 오른쪽 뷰어 너비 적용 (막대기 크기 10px 제외하고 나머지)
        // flex-grow를 쓰고 있으므로 오른쪽은 width 지정 안 해도 되지만,
        // 명확하게 하려면 calc 사용
        right.style.width = `calc(${100 - percentage}% - 10px)`;

        // [핵심] 뷰어 엔진에게 "야 창크기 바꼈다 다시 그려!" 명령
        // (쓰로틀링 없이 실시간으로 하면 부드럽지만 사양을 좀 먹음)
        if (window.viewer2D) window.viewer2D.resize();
        if (window.viewer3D) window.viewer3D.resize();
    });

    // 3. 드래그 끝
    document.addEventListener('mouseup', function () {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = 'default';
            // 마지막으로 한 번 더 리사이즈 확실하게
            if (window.viewer2D) window.viewer2D.resize();
            if (window.viewer3D) window.viewer3D.resize();
        }
    });
}