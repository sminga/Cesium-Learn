# """
# 替代 NCO 工具链的 Python 脚本
# 功能等价于 processNetCDF.ps1 + scale.nco + defineLev.nco + getMinMax.nco
# 依赖: pip install netCDF4 xarray numpy

# ------------------------------------------------------------
# 使用方法

# 安装依赖（你已经装好了 netCDF4，补装 xarray）
# powershell
# D:\APP\Miniconda\envs\nco_env\Scripts\python.exe -m pip install xarray --trusted-host pypi.tuna.tsinghua.edu.cn -i https://pypi.tuna.tsinghua.edu.cn/simple
#
# 运行
# powershell
# D:\APP\Miniconda\envs\nco_env\Scripts\python.exe process_netcdf.py "D:\path\to\your\file.nc"


# 输出两个文件：
# scaled.nc — 归一化后的标量变量
# uv.nc — 带 lev 维度、纬度翻转、含 min/max 属性的风场数据


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

    # ========== 1. 处理标量变量（对应 scale.nco）==========
    scalar_var_names = [
        "Precipitable_water_entire_atmosphere_single_layer",
        "Pressure_surface",
        "Temperature_surface",
        "Wind_speed_gust_surface",
    ]

    ds_scalar = xr.open_dataset(file_path)[scalar_var_names]
    for var in scalar_var_names:
        ds_scalar[var] = normalize_to_255(ds_scalar[var])

    scaled_path = output_dir / "scaled.nc"
    ds_scalar.to_netcdf(scaled_path)
    print(f"[OK] 标量变量归一化完成 -> {scaled_path}")

    # ========== 2. 处理风场变量（对应 defineLev.nco + ncecat + ncpdq + getMinMax.nco）==========
    u_name = "u-component_of_wind_planetary_boundary"
    v_name = "v-component_of_wind_planetary_boundary"

    ds_wind = xr.open_dataset(file_path)[[u_name, v_name]]

    # 重命名 U/V（对应 ncrename）
    ds_wind = ds_wind.rename({u_name: "U", v_name: "V"})

    # 添加 lev 维度（对应 defineLev.nco + ncecat --no_rec_dmn）
    # NCO 原始逻辑: 定义 lev=1.0 单点维度 -> ncecat 创建记录维度 -> ncks 去掉记录维度
    # 等价于直接 expand_dims
    ds_wind = ds_wind.expand_dims(lev=[1.0])
    ds_wind["lev"].attrs["long_name"] = "Level"

    # 纬度翻转（对应 ncpdq -a "-lat"）
    if "lat" in ds_wind.dims:
        ds_wind = ds_wind.isel(lat=slice(None, None, -1))

    # 计算 U/V 的 min/max 并写入属性（对应 getMinMax.nco）
    for var in ["U", "V"]:
        ds_wind[var].attrs["min"] = float(ds_wind[var].min())
        ds_wind[var].attrs["max"] = float(ds_wind[var].max())

    uv_path = output_dir / "uv.nc"
    ds_wind.to_netcdf(uv_path)
    print(f"[OK] 风场处理完成 -> {uv_path}")

    # 清理临时文件（NCO 版本会产生 temp*.nc，Python 版本不产生中间文件）
    print("[OK] 无临时文件需要清理")


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("用法: python process_netcdf.py <path/to/file.nc>")
        sys.exit(1)
    process_netcdf(sys.argv[1])