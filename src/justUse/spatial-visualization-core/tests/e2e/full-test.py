"""
Spatial Visualization Core - 全面前端测试脚本
测试范围：UI交互、风场可视化、林火蔓延、高斯泼溅、地图服务切换
"""

from playwright.sync_api import sync_playwright
import json
import time
from datetime import datetime

class TestResult:
    def __init__(self):
        self.results = []
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def add(self, category, test_name, passed, message="", error=None):
        result = {
            "category": category,
            "test_name": test_name,
            "passed": passed,
            "message": message,
            "error": str(error) if error else None,
            "timestamp": datetime.now().isoformat()
        }
        self.results.append(result)
        if passed:
            self.passed += 1
        else:
            self.failed += 1
            if error:
                self.errors.append(f"[{category}] {test_name}: {error}")
    
    def get_report(self):
        return {
            "summary": {
                "total": self.passed + self.failed,
                "passed": self.passed,
                "failed": self.failed,
                "pass_rate": f"{(self.passed / (self.passed + self.failed) * 100):.1f}%" if (self.passed + self.failed) > 0 else "0%"
            },
            "results": self.results,
            "errors": self.errors
        }

def run_tests():
    test_result = TestResult()
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()
        
        console_logs = []
        errors = []
        
        def handle_console(msg):
            console_logs.append({
                "type": msg.type,
                "text": msg.text
            })
        
        def handle_error(error):
            errors.append(str(error))
        
        page.on("console", handle_console)
        page.on("pageerror", handle_error)
        
        print("=" * 60)
        print("Spatial Visualization Core - 前端功能测试")
        print("=" * 60)
        
        # ============================================
        # 1. 页面加载测试
        # ============================================
        print("\n[1] 测试页面加载...")
        try:
            page.goto("http://localhost:5173/", timeout=60000)
            page.wait_for_load_state("networkidle", timeout=30000)
            test_result.add("页面加载", "页面成功加载", True, "页面加载完成，进入networkidle状态")
        except Exception as e:
            test_result.add("页面加载", "页面成功加载", False, "页面加载失败", e)
            browser.close()
            return test_result.get_report()
        
        # 检查加载遮罩是否隐藏
        try:
            loading_overlay = page.locator("#loadingOverlay")
            is_hidden = loading_overlay.is_hidden(timeout=5000)
            test_result.add("页面加载", "加载遮罩隐藏", is_hidden, "加载完成后遮罩应隐藏")
        except Exception as e:
            test_result.add("页面加载", "加载遮罩隐藏", False, "检查加载遮罩失败", e)
        
        # 检查Cesium容器
        try:
            cesium_container = page.locator("#cesiumContainer")
            is_visible = cesium_container.is_visible()
            test_result.add("页面加载", "Cesium容器可见", is_visible, "3D地球容器应可见")
        except Exception as e:
            test_result.add("页面加载", "Cesium容器可见", False, "检查Cesium容器失败", e)
        
        # 检查控制面板
        try:
            panel = page.locator(".panel")
            is_visible = panel.is_visible()
            test_result.add("页面加载", "控制面板可见", is_visible, "左侧控制面板应可见")
        except Exception as e:
            test_result.add("页面加载", "控制面板可见", False, "检查控制面板失败", e)
        
        # 检查状态栏
        try:
            status_bar = page.locator(".status-bar")
            is_visible = status_bar.is_visible()
            test_result.add("页面加载", "状态栏可见", is_visible, "底部状态栏应可见")
        except Exception as e:
            test_result.add("页面加载", "状态栏可见", False, "检查状态栏失败", e)
        
        # ============================================
        # 2. 风场可视化测试
        # ============================================
        print("\n[2] 测试风场可视化...")
        
        # 检查风场数据状态
        try:
            wind_status = page.locator("#windDataStatus")
            status_text = wind_status.text_content()
            test_result.add("风场可视化", "风场数据加载", "已加载" in status_text, f"状态: {status_text}")
        except Exception as e:
            test_result.add("风场可视化", "风场数据加载", False, "检查风场状态失败", e)
        
        # 测试显示/隐藏按钮
        try:
            state_btn = page.locator("#statechange")
            initial_text = state_btn.text_content()
            state_btn.click()
            page.wait_for_timeout(500)
            new_text = state_btn.text_content()
            test_result.add("风场可视化", "显示/隐藏切换", initial_text != new_text, 
                          f"按钮文字从 '{initial_text}' 变为 '{new_text}'")
            # 恢复原状态
            state_btn.click()
            page.wait_for_timeout(500)
        except Exception as e:
            test_result.add("风场可视化", "显示/隐藏切换", False, "切换失败", e)
        
        # 测试初始化视角按钮
        try:
            init_btn = page.locator("#Initializeperspective")
            is_enabled = init_btn.is_enabled()
            test_result.add("风场可视化", "初始化视角按钮可用", is_enabled, "按钮应可用")
            if is_enabled:
                init_btn.click()
                page.wait_for_timeout(2000)
                test_result.add("风场可视化", "初始化视角执行", True, "视角动画执行完成")
        except Exception as e:
            test_result.add("风场可视化", "初始化视角", False, "执行失败", e)
        
        # 测试粒子参数面板
        try:
            panel_container = page.locator("#panelContainer")
            is_visible = panel_container.is_visible()
            test_result.add("风场可视化", "粒子参数面板可见", is_visible, "dat.gui面板应可见")
        except Exception as e:
            test_result.add("风场可视化", "粒子参数面板可见", False, "检查失败", e)
        
        # ============================================
        # 3. 林火蔓延测试
        # ============================================
        print("\n[3] 测试林火蔓延...")
        
        # 检查林火蔓延面板
        try:
            fire_panel = page.locator(".fire-panel")
            is_visible = fire_panel.is_visible()
            test_result.add("林火蔓延", "林火蔓延面板可见", is_visible, "面板应可见")
        except Exception as e:
            test_result.add("林火蔓延", "林火蔓延面板可见", False, "检查失败", e)
        
        # 检查燃料模型选择
        try:
            fuel_select = page.locator("#fuelModelSelect")
            options = fuel_select.locator("option").all()
            test_result.add("林火蔓延", "燃料模型选项", len(options) == 13, 
                          f"应有13个选项，实际: {len(options)}")
        except Exception as e:
            test_result.add("林火蔓延", "燃料模型选项", False, "检查失败", e)
        
        # 检查初始化按钮
        try:
            fire_init_btn = page.locator("#fireInit")
            is_enabled = fire_init_btn.is_enabled()
            test_result.add("林火蔓延", "初始化按钮可用", is_enabled, "按钮应可用")
        except Exception as e:
            test_result.add("林火蔓延", "初始化按钮可用", False, "检查失败", e)
        
        # 测试初始化林火蔓延
        try:
            fire_init_btn = page.locator("#fireInit")
            fire_init_btn.click()
            page.wait_for_timeout(3000)
            
            fire_status = page.locator("#fireStatus")
            status_text = fire_status.text_content()
            test_result.add("林火蔓延", "初始化执行", "已初始化" in status_text or "初始化" in status_text, 
                          f"状态: {status_text}")
        except Exception as e:
            test_result.add("林火蔓延", "初始化执行", False, "执行失败", e)
        
        # 检查点火按钮状态
        try:
            fire_ignite_btn = page.locator("#fireIgnite")
            is_enabled = fire_ignite_btn.is_enabled()
            test_result.add("林火蔓延", "点火按钮可用", is_enabled, "初始化后应可用")
        except Exception as e:
            test_result.add("林火蔓延", "点火按钮可用", False, "检查失败", e)
        
        # ============================================
        # 4. 高斯泼溅测试
        # ============================================
        print("\n[4] 测试高斯泼溅...")
        
        # 检查高斯泼溅面板
        try:
            splat_panel = page.locator(".splat-panel")
            is_visible = splat_panel.is_visible()
            test_result.add("高斯泼溅", "高斯泼溅面板可见", is_visible, "面板应可见")
        except Exception as e:
            test_result.add("高斯泼溅", "高斯泼溅面板可见", False, "检查失败", e)
        
        # 检查初始化按钮
        try:
            splat_init_btn = page.locator("#splatInit")
            is_enabled = splat_init_btn.is_enabled()
            test_result.add("高斯泼溅", "初始化按钮可用", is_enabled, "按钮应可用")
        except Exception as e:
            test_result.add("高斯泼溅", "初始化按钮可用", False, "检查失败", e)
        
        # 检查文件输入
        try:
            splat_file_input = page.locator("#splatFileInput")
            is_visible = splat_file_input.is_visible()
            test_result.add("高斯泼溅", "文件输入可见", is_visible, "文件选择器应可见")
        except Exception as e:
            test_result.add("高斯泼溅", "文件输入可见", False, "检查失败", e)
        
        # 检查位置输入
        try:
            splat_lon = page.locator("#splatLon")
            splat_lat = page.locator("#splatLat")
            lon_visible = splat_lon.is_visible()
            lat_visible = splat_lat.is_visible()
            test_result.add("高斯泼溅", "位置输入可见", lon_visible and lat_visible, "经纬度输入应可见")
        except Exception as e:
            test_result.add("高斯泼溅", "位置输入可见", False, "检查失败", e)
        
        # ============================================
        # 5. 地图服务测试
        # ============================================
        print("\n[5] 测试地图服务...")
        
        # 检查地图设置容器
        try:
            map_settings = page.locator("#mapSettingsContainer")
            is_visible = map_settings.is_visible()
            test_result.add("地图服务", "地图设置面板可见", is_visible, "面板应可见")
        except Exception as e:
            test_result.add("地图服务", "地图设置面板可见", False, "检查失败", e)
        
        # ============================================
        # 6. UI布局测试
        # ============================================
        print("\n[6] 测试UI布局...")
        
        # 检查各section标题
        try:
            section_titles = page.locator(".section-title").all()
            test_result.add("UI布局", "Section标题数量", len(section_titles) >= 4, 
                          f"应有至少4个section，实际: {len(section_titles)}")
        except Exception as e:
            test_result.add("UI布局", "Section标题数量", False, "检查失败", e)
        
        # 检查按钮样式
        try:
            buttons = page.locator("button").all()
            enabled_count = sum(1 for btn in buttons if btn.is_enabled())
            test_result.add("UI布局", "按钮渲染", len(buttons) > 0, 
                          f"共{len(buttons)}个按钮，{enabled_count}个可用")
        except Exception as e:
            test_result.add("UI布局", "按钮渲染", False, "检查失败", e)
        
        # ============================================
        # 7. 控制台日志检查
        # ============================================
        print("\n[7] 检查控制台日志...")
        
        error_logs = [log for log in console_logs if log["type"] == "error"]
        warning_logs = [log for log in console_logs if log["type"] == "warning"]
        
        test_result.add("控制台", "无严重错误", len(error_logs) == 0, 
                       f"发现 {len(error_logs)} 个错误日志")
        
        # 检查关键日志
        main_logs = [log for log in console_logs if "[Main]" in log["text"]]
        test_result.add("控制台", "主程序日志", len(main_logs) > 0, 
                       f"发现 {len(main_logs)} 条主程序日志")
        
        cleaner_logs = [log for log in console_logs if "[DataCleaner]" in log["text"]]
        test_result.add("控制台", "数据清洗日志", len(cleaner_logs) > 0, 
                       f"发现 {len(cleaner_logs)} 条数据清洗日志")
        
        # ============================================
        # 8. 截图保存
        # ============================================
        print("\n[8] 保存测试截图...")
        try:
            page.screenshot(path="test-screenshot-final.png", full_page=True)
            test_result.add("截图", "最终截图保存", True, "保存到 test-screenshot-final.png")
        except Exception as e:
            test_result.add("截图", "最终截图保存", False, "保存失败", e)
        
        browser.close()
    
    return test_result.get_report()

if __name__ == "__main__":
    report = run_tests()
    
    print("\n" + "=" * 60)
    print("测试报告")
    print("=" * 60)
    print(f"总测试数: {report['summary']['total']}")
    print(f"通过: {report['summary']['passed']}")
    print(f"失败: {report['summary']['failed']}")
    print(f"通过率: {report['summary']['pass_rate']}")
    
    if report['errors']:
        print("\n错误列表:")
        for error in report['errors']:
            print(f"  - {error}")
    
    # 保存详细报告
    with open("test-report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print("\n详细报告已保存到 test-report.json")
