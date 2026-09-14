
# # ------------------------------------------------------------
# # 使用方法
# 打开 PowerShell，执行以下命令（请根据你实际的文件路径进行替换）：
# powershell
# py D:\scripts\process_netcdf.py "D:\data\test_file.nc"
# 💡 提示：你可以先输入 py D:\scripts\process_netcdf.py （注意最后有个空格），然后把你的 .nc 文件直接拖拽到 PowerShell 窗口中，它会自动补全完整路径，按回车即可。

# 第四步：查看结果
# 如果运行成功，你会看到如下输出：
# text
# [OK] 标量变量归一化完成 -> D:\data\scaled.nc
# [OK] 风场处理完成 -> D:\data\uv.nc
# [OK] 无临时文件需要清理

# 此时，在你的 .nc 文件所在的同级目录下，就会生成处理好的 scaled.nc 和 uv.nc 两个新文件。
# ⚠️ 常见问题排查
# 找不到文件：检查路径是否正确，包含空格的路径一定要加双引号 ""。
# 找不到变量名：如果你的原始 .nc 文件中的变量名和脚本中写的不完全一致（比如大小写不同），会报错。你可以用以下命令查看原始文件里的变量名：
# powershell
# # py -c "import xarray as xr; print(xr.open_dataset('D:\data\test_file.nc'))"

#--------------------------------------------
# ⚠️ 注意事项
# UNIX 换行符问题不存在了 — NCO 的 .nco 脚本要求 UNIX 换行符（LF），Windows 下容易出错。Python 没有这个限制。
# 如果原始文件很大，可以在 xr.open_dataset() 时加 chunks="auto" 启用 dask 延迟计算，避免一次性加载到内存：
# python
# ds = xr.open_dataset(file_path, chunks="auto")
# 需要额外安装 dask：pip install dask

# 输出格式：默认输出 NetCDF4 格式。如需 NetCDF3（与 NCO -3 参数一致），改为：
# python
# ds.to_netcdf(path, format="NETCDF3_CLASSIC")

import numpy as np
import xarray as xr
from pathlib import Path


def normalize_to_255(da: xr.DataArray) -> xr.DataArray:
    """将 DataArray 线性归一化到 [0, 255]"""
    vmin = da.min()
    vmax = da.max()
    if vmax == vmin:
        return xr.full_like(da, 0.0, dtype=np.float32)
    return ((da - vmin) / (vmax - vmin) * 255.0).astype(np.float32)


def process_netcdf(file_path: str):
    file_path = Path(file_path)
    output_dir = file_path.parent

    # ========== 1. 处理标量变量 ==========
    ds_scalar = xr.open_dataset(file_path)
    scalar_var_names = list(ds_scalar.data_vars)
    print(f"[INFO] 检测到以下变量将进行归一化: {scalar_var_names}")

    # 对每个变量进行归一化
    for var in scalar_var_names:
        ds_scalar[var] = normalize_to_255(ds_scalar[var])

    scaled_path = output_dir / "scaled.nc"
    ds_scalar.to_netcdf(scaled_path)
    print(f"[OK] 标量变量归一化完成 -> {scaled_path}")

    # ========== 2. 处理风场变量（自动检测 U/V）==========
    # 注意：这里必须重新从原始文件读取，因为 ds_scalar 已经被归一化修改了
    ds_original = xr.open_dataset(file_path)
    all_vars = list(ds_original.data_vars)
    
    # 兼容多种常见的 U/V 变量命名
    u_candidates = ['u_wind', 'u-component_of_wind_planetary_boundary', 'U', 'u']
    v_candidates = ['v_wind', 'v-component_of_wind_planetary_boundary', 'V', 'v']
    
    u_name = next((v for v in u_candidates if v in all_vars), None)
    v_name = next((v for v in v_candidates if v in all_vars), None)

    if u_name and v_name:
        print(f"[INFO] 检测到风场分量: U={u_name}, V={v_name}")
        ds_wind = ds_original[[u_name, v_name]]
        
        # 重命名为统一的 U/V
        ds_wind = ds_wind.rename({u_name: "U", v_name: "V"})
        
        # 添加 lev 维度
        ds_wind = ds_wind.expand_dims(lev=[1.0])
        ds_wind["lev"].attrs["long_name"] = "Level"

        # 纬度翻转（Cesium 通常需要）
        if "lat" in ds_wind.dims:
            ds_wind = ds_wind.isel(lat=slice(None, None, -1))

        # 计算并写入 min/max 属性
        for var in ["U", "V"]:
            ds_wind[var].attrs["min"] = float(ds_wind[var].min())
            ds_wind[var].attrs["max"] = float(ds_wind[var].max())

        uv_path = output_dir / "uv.nc"
        ds_wind.to_netcdf(uv_path)
        print(f"[OK] 风场处理完成 -> {uv_path}")
    else:
        print("[INFO] 当前文件不包含 U/V 分量，跳过风场矢量纹理生成。")

    print("[OK] 无临时文件需要清理")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("用法: python process_netcdf.py <path/to/file.nc>")
        sys.exit(1)
    process_netcdf(sys.argv[1])