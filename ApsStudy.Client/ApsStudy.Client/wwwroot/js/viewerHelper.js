// 전역 변수
var viewer2D; // 왼쪽
var viewer3D; // 오른쪽
var isSyncing = false; // [핵심] 무한 루프 방지용 락(Lock)
var currentDoc = null; // [신규] 문서 정보 저장용 (시트 찾을 때 사용)

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

        // 1. 기존 뷰어들 정리
        if (viewer2D) { viewer2D.finish(); viewer2D = null; }
        if (viewer3D) { viewer3D.finish(); viewer3D = null; }

        // 2. 뷰어 각각 생성
        var div2d = document.getElementById(div2dId);
        var div3d = document.getElementById(div3dId);

        // [설정] 2D용은 가볍게
        viewer2D = new Autodesk.Viewing.GuiViewer3D(div2d, { extensions: ['Autodesk.DocumentBrowser'] });

        // [설정] 3D용은 풀옵션
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

        // 4. 기능 연결
        setupDualSelectionSync(viewer2D, viewer3D); // 동기화
        setupSpecificAlert(viewer3D); // [형님 요청] 자동 시트 열기 로직

        // 5. 문서 로드
        var documentId = 'urn:' + urn;
        Autodesk.Viewing.Document.load(documentId, onDualDocumentLoadSuccess, onDocumentLoadFailure);
    });
}

// 문서 로드 성공 시 -> 2D/3D 분배 로직
function onDualDocumentLoadSuccess(doc) {
    console.log('✅ 문서 로드 성공. 뷰 분배 시작...');

    currentDoc = doc; // [중요] 문서 정보를 전역 변수에 저장 (나중에 시트 찾을 때 씀)

    // 1. 2D 뷰(Sheet) 찾기
    var items2d = doc.getRoot().search({ 'type': 'geometry', 'role': '2d' });

    // 2. 3D 뷰(Model) 찾기
    var items3d = doc.getRoot().search({ 'type': 'geometry', 'role': '3d' });

    // --- [왼쪽 2D 뷰어 로드] ---
    if (items2d && items2d.length > 0) {
        viewer2D.loadDocumentNode(doc, items2d[0]).then(i => {
            console.log('📄 2D 뷰 로드 완료');
            viewer2D.fitToView();
            setViewerBackgroundWhite(viewer2D); // 배경 흰색 처리
        });
    } else {
        console.warn("⚠️ 이 파일엔 2D 시트가 없습니다.");
    }

    // --- [오른쪽 3D 뷰어 로드] ---
    if (items3d && items3d.length > 0) {
        viewer3D.loadDocumentNode(doc, items3d[0]).then(i => {
            console.log('🧊 3D 뷰 로드 완료');

            // 3D 풀옵션 설정
            viewer3D.fitToView();
            viewer3D.navigation.setReverseZoomDirection(true);
            viewer3D.setDisplayEdges(true);
            viewer3D.setLightPreset(6);
            viewer3D.setQualityLevel(true, true);
            viewer3D.setGroundShadow(true);
            viewer3D.setEnvMapBackground(false);

            // 자동 숨김 기능 (3D에만 적용)
            applyAutoHiding(viewer3D);
        });
    } else {
        console.error("❌ 3D 뷰가 없습니다.");
    }
}

function onDocumentLoadFailure(code, msg) {
    console.error('❌ 로드 실패: ' + code + ' / ' + msg);
}

// [최종 로직] 3D 객체의 'Assembly Name'을 뽑아서 -> 2D 시트 찾아 열기
function setupSpecificAlert(viewerInstance) {
    if (!viewerInstance) return;

    viewerInstance.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, function (event) {
        if (event.dbIdArray.length === 0) return;

        var dbId = event.dbIdArray[0];

        // 1. 3D 객체의 'Assembly Name' 속성 가져오기
        viewerInstance.model.getBulkProperties([dbId], null, function (results) {
            if (results.length === 0) return;

            var item = results[0];
            var props = item.properties;

            // Name (상위 노드 이름)
            var nameVal = item.name ? item.name : "";

            // 형님이 원하시던 Property 값 추출
            var typeProp = props.find(p => p.displayName === 'Type Name');
            var assemblyProp = props.find(p => p.displayName === 'Assembly Name');

            var typeVal = typeProp ? typeProp.displayValue : "";
            var assemblyVal = assemblyProp ? assemblyProp.displayValue : "";

            // [조건] Name에 'Direct Shape' 포함 && Type Name이 'JBK_Face_DS' (대소문자 주의)
            if (nameVal.indexOf("Direct Shape") > -1 && typeVal === "JBK_FACE_DS") {

                console.log("🎯 [조건 일치] 3D Assembly Name: " + assemblyVal);

                if (assemblyVal && assemblyVal !== "값 없음") {
                    // 찾은 Assembly Name을 들고 시트 찾으러 갑니다
                    openSheetByAssemblyName(assemblyVal);
                }
            }
        });
    });
    console.log("🕵️‍♂️ [Logic] Assembly 연동 준비 완료");
}

// [최종 수정] 3D Assembly Name과 일치하는 2D 시트 찾기 (에러 수정판)
function openSheetByAssemblyName(targetName) {
    if (!currentDoc || !viewer2D) {
        console.error("❌ 문서나 2D 뷰어가 준비되지 않음");
        return;
    }

    console.log("🔍 [Search] 시트 찾는 중... 목표(Assembly Name): " + targetName);

    // 1. 문서 내의 모든 2D 시트(BubbleNode) 가져오기
    var all2DViews = currentDoc.getRoot().search({ 'type': 'geometry', 'role': '2d' });

    // 2. 시트 목록을 뒤져서 이름 매칭
    var match = all2DViews.find(function (item) {

        // [형님 요청하신 수정 부분] 
        // item.name은 상황에 따라 함수일 수도 있고 변수일 수도 있어서 이렇게 안전하게 꺼내야 합니다.
        var sheetName = "";

        if (typeof item.name === 'function') {
            sheetName = item.name(); // 함수면 실행 ()
        } else if (item.data && item.data.name) {
            sheetName = item.data.name; // 데이터 안에 있으면 꺼냄
        } else {
            sheetName = item.name || ""; // 그냥 변수면 가져옴
        }

        // 이름 없으면 패스
        if (!sheetName) return false;

        // [비교] 시트 이름 안에 Assembly Name이 들어있는지 확인
        // (Revit Assembly 시트 이름은 보통 "A101 - [Assembly Name]" 형식이니까 포함 여부로 찾습니다)
        return sheetName.indexOf(targetName) > -1;
    });

    if (match) {
        // 찾은 시트 이름 로그 찍기
        var foundName = (typeof match.name === 'function' ? match.name() : match.name);
        console.log("✅ [Found] 시트 발견! (" + foundName + ") -> 로드합니다.");

        // 3. 2D 뷰어에 해당 시트 로드
        viewer2D.loadDocumentNode(currentDoc, match).then(function () {
            viewer2D.fitToView();

            // 배경 흰색 처리
            var ThreeColor = (typeof THREE !== 'undefined' && THREE.Color) ? THREE.Color : Autodesk.Viewing.Private.THREE.Color;
            try {
                if (viewer2D.setClearColor) viewer2D.setClearColor(new ThreeColor(0xffffff));
                else if (viewer2D.impl) viewer2D.impl.setClearColor(new ThreeColor(0xffffff));
                viewer2D.impl.invalidate(true);
            } catch (e) { }
        });
    } else {
        console.warn("⚠️ [Not Found] '" + targetName + "' 가 포함된 시트를 찾을 수 없습니다.");
    }
}

// [유틸] 뷰어 배경 흰색으로 강제 변경
function setViewerBackgroundWhite(viewer) {
    var ThreeColor = (typeof THREE !== 'undefined' && THREE.Color)
        ? THREE.Color
        : Autodesk.Viewing.Private.THREE.Color;

    try {
        if (viewer.setClearColor) {
            viewer.setClearColor(new ThreeColor(0xffffff));
        } else if (viewer.impl) {
            viewer.impl.setClearColor(new ThreeColor(0xffffff));
        }
        viewer.impl.invalidate(true);
    } catch (e) {
        console.warn("배경색 변경 실패:", e);
    }
}

// -------------------------------------------------------------
// [기존 유지] 2D <-> 3D 양방향 선택 + 줌인(Fit) 동기화
// -------------------------------------------------------------
function setupDualSelectionSync(viewer2D, viewer3D) {
    if (!viewer2D || !viewer3D) return;

    // 2D -> 3D
    viewer2D.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, function (event) {
        if (isSyncing) return;
        isSyncing = true;
        viewer3D.select(event.dbIdArray);
        if (event.dbIdArray.length > 0) viewer3D.fitToView(event.dbIdArray);
        isSyncing = false;
    });

    // 3D -> 2D
    viewer3D.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, function (event) {
        if (isSyncing) return;
        isSyncing = true;
        viewer2D.select(event.dbIdArray);
        if (event.dbIdArray.length > 0) viewer2D.fitToView(event.dbIdArray);
        isSyncing = false;
    });
}

// [기존 유지] 자동 숨김 로직
function applyAutoHiding(viewerInstance) {
    if (!viewerInstance) return;
    if (viewerInstance.model.isObjectTreeLoaded()) {
        executeHideLogic(viewerInstance);
    } else {
        viewerInstance.addEventListener(Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, function () {
            executeHideLogic(viewerInstance);
        });
    }
}

function executeHideLogic(viewerInstance) {
    viewerInstance.search('Direct Shape', function (dbIds) {
        if (dbIds.length === 0) {
            retrySearchDummy(viewerInstance);
            return;
        }
        viewerInstance.model.getBulkProperties(dbIds, ['Type Name'], function (results) {
            var killList = [];
            results.forEach(function (item) {
                var typeProp = item.properties.find(p => p.displayName === 'Type Name');
                if (typeProp && typeProp.displayValue === 'formwork_dummy') {
                    killList.push(item.dbId);
                }
            });
            if (killList.length > 0) viewerInstance.hide(killList);
        });
    }, null, ['Name']);
}

function retrySearchDummy(viewerInstance) {
    viewerInstance.search('formwork_dummy', function (dbIds) {
        if (dbIds.length > 0) viewerInstance.hide(dbIds);
    }, null, ['Type Name']);
}

// [기존 유지] 리사이즈 대응
window.addEventListener('resize', function () {
    if (viewer2D) viewer2D.resize();
    if (viewer3D) viewer3D.resize();
});

// [기존 유지] 드래그 리사이즈 핸들러
function enableResizer(leftId, rightId, gutterId) {
    const left = document.getElementById(leftId);
    const right = document.getElementById(rightId);
    const gutter = document.getElementById(gutterId);
    const container = left.parentElement;

    if (!left || !right || !gutter || !container) return;

    let isDragging = false;

    gutter.addEventListener('mousedown', function (e) {
        isDragging = true;
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
        if (!isDragging) return;
        let containerRect = container.getBoundingClientRect();
        let mouseX = e.clientX - containerRect.left;
        let percentage = (mouseX / containerRect.width) * 100;
        if (percentage < 10) percentage = 10;
        if (percentage > 90) percentage = 90;

        left.style.width = `${percentage}%`;
        right.style.width = `calc(${100 - percentage}% - 10px)`;

        if (window.viewer2D) window.viewer2D.resize();
        if (window.viewer3D) window.viewer3D.resize();
    });

    document.addEventListener('mouseup', function () {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = 'default';
            if (window.viewer2D) window.viewer2D.resize();
            if (window.viewer3D) window.viewer3D.resize();
        }
    });
}