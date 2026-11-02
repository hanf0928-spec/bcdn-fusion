## 1. 接口描述

接口请求域名： teo.tencentcloudapi.com 。

通过本接口查询计费数据。

默认接口请求频率限制：50次/秒。

<div class="rno-api-explorer">
    <div class="rno-api-explorer-inner">
        <div class="rno-api-explorer-hd">
            <div class="rno-api-explorer-title">
                推荐使用 API Explorer
            </div>
            <a href="https://console.cloud.tencent.com/api/explorer?Product=teo&Version=2022-09-01&Action=DescribeBillingData" class="rno-api-explorer-btn" hotrep="doc.api.explorerbtn"><i class="rno-icon-explorer"></i>点击调试</a>
        </div>
        <div class="rno-api-explorer-body">
            <div class="rno-api-explorer-cont">
                API Explorer 提供了在线调用、签名验证、SDK 代码生成和快速检索接口等能力。您可查看每次调用的请求内容和返回结果以及自动生成 SDK 调用示例。
            </div>
        </div>
    </div>
</div>

## 2. 输入参数

以下请求参数列表仅列出了接口请求参数和部分公共参数，完整公共参数列表见 [公共请求参数](/document/api/1552/80724)。

| 参数名称 | 必选 | 类型 | 描述 |
|---------|---------|---------|---------|
| Action | 是 | String | [公共参数](/document/api/1552/80724)，本接口取值：DescribeBillingData。 |
| Version | 是 | String | [公共参数](/document/api/1552/80724)，本接口取值：2022-09-01。 |
| Region | 否 | String | [公共参数](/document/api/1552/80724)，此参数为可选参数。 |
| StartTime | 是 | [Timestamp ISO8601](/document/api/1552/80728) | 起始时间。 |
| EndTime | 是 | [Timestamp ISO8601](/document/api/1552/80728) | 结束时间。查询时间范围（`EndTime` - `StartTime`）需小于等于 31 天。 |
| ZoneIds.N | 是 | Array of String | 站点 ID 集合，此参数必填。最多传入 100 个站点 ID。若需查询腾讯云主账号下所有站点数据，请用 `*` 代替，查询账号级别数据需具备本接口全部站点资源权限。 |
| MetricName | 是 | String | 指标列表，取值如下：<br/><b>四/七层加速流量：</b><li>acc_flux: 内容加速流量，单位为 Byte；</li><li>smt_flux: 智能加速流量，单位为 Byte；</li><li>l4_flux: 四层加速流量，单位为 Byte；</li><li>sec_flux: 独立防护流量，单位为 Byte；</li><li>zxctg_flux: 中国大陆网络优化流量，单位为 Byte。</li><br><b>四/七层加速带宽:</b><li>acc_bandwidth: 内容加速带宽，单位为 bps；</li><li>smt_bandwidth: 智能加速带宽，单位为 bps；</li><li>l4_bandwidth: 四层加速带宽，单位为 bps；</li><li>sec_bandwidth: 独立防护带宽，单位为 bps；</li><li>zxctg_bandwidth: 中国大陆网络优化带宽，单位为 bps。</li><br><b>HTTP/HTTPS 安全请求数：</b><li>sec_request_clean: HTTP/HTTPS 请求，单位为次。</li><b><br>增值服务用量：</b><li>smt_request_clean: 智能加速请求，单位为次；</li><li>quic_request: QUIC 请求，单位为次；</li><li>bot_request_clean: Bot 请求，单位为次；</li><li>cls_count: 实时日志推送条数，单位为条；</li><li>ddos_bandwidth: 弹性 DDoS 防护带宽，单位为 bps。</li><br><b>边缘计算用量：</b><li>edgefunction_request：边缘函数请求数，单位为次；</li><li>edgefunction_cpu_time：边缘函数CPU处理时间，单位为毫秒。</li><br/><b>媒体处理用量：</b><li>total_transcode：所有规格音频，视频即时转码，转封装时长，单位为秒；</li><li>remux：转封装时长，单位为秒；</li><li>transcode_audio：音频转码时长，单位为秒；</li><li>transcode_H264_SD：H.264 编码方式的标清视频（短边 <= 480 px）时长，单位为秒；</li><li>transcode_H264_HD：H.264 编码方式的高清视频（短边 <= 720 px）时长，单位为秒；</li><li>transcode_H264_FHD：H.264 编码方式的全高清视频（短边 <= 1080 px）时长，单位为秒；</li><li>transcode_H264_2K：H.264 编码方式的 2K 视频（短边 <= 1440 px）时长，单位为秒。</li> |
| Interval | 是 | String | 查询时间粒度，取值有：<br/><li>5min：5 分钟粒度；</li><li>hour：1 小时粒度；</li><li>day：1 天粒度。</li> |
| Filters.N | 否 | Array of [BillingDataFilter](/document/api/1552/80721#BillingDataFilter) | 过滤条件，详细的过滤条件取值如下：<br/><li>host：按照域名进行过滤。示例值：test.example.com。<br></li><li>proxy-id：按照四层代理实例 ID 进行过滤。示例值：sid-2rugn89bkla9。<br></li><li>region-id：按照计费大区进行过滤。可选项如下：<br>  CH：中国大陆境内<br>  AF：非洲<br>  AS1：亚太一区<br>  AS2：亚太二区<br>  AS3：亚太三区<br>  EU：欧洲<br>  MidEast：中东<br>  NA：北美<br>  SA：南美</li><br/>说明：相同 `Type` 的 `BillingDataFilter` 之间为“或”关系，不同 `Type` 的 `BillingDataFilter` 之间为“且”关系。 |
| GroupBy.N | 否 | Array of String | 分组聚合维度。最多允许同时按照两种维度进行分组。取值如下：  <li>zone-id：按照站点 ID 进行分组，若使用了内容标识符功能，则优先按照内容标识符分组；<br></li><li>host：按照域名进行分组；<br></li> <li>proxy-id：按照四层代理实例 ID 进行分组；<br></li> <li>region-id：按照计费大区进行分组。</li>  |

## 3. 输出参数

| 参数名称 | 类型 | 描述 |
|---------|---------|---------|
| Data | Array of [BillingData](/document/api/1552/80721#BillingData) | 数据点列表。<br/>注意：此字段可能返回 null，表示取不到有效值。|
| RequestId | String | 唯一请求 ID，由服务端生成，每次请求都会返回（若请求因其他原因未能抵达服务端，则该次请求不会获得 RequestId）。定位问题时需要提供该次请求的 RequestId。|

## 4. 示例

### 示例1 查询指定站点在指定计费大区的内容加速流量

查询指定 zone-id 在指定 region-id 下的内容加速流量计费用量，查询时间粒度为天。

#### 输入示例

```
POST / HTTP/1.1
Host: teo.tencentcloudapi.com
Content-Type: application/json
X-TC-Action: DescribeBillingData
<公共请求参数>

{
    "StartTime": "2024-01-01T00:00:00+08:00",
    "EndTime": "2024-01-24T03:20:00+08:00",
    "Interval": "day",
    "MetricName": "acc_flux",
    "Filters": [
        {
            "Type": "region-id",
            "Value": "MidEast"
        }
    ],
    "ZoneIds": [
        "zone-2smdfso9dr58"
    ]
}
```

#### 输出示例

```json
{
    "Response": {
        "RequestId": "457e8933-4296-4878-9a7f-fb888559e29e",
        "Data": [
            {
                "Time": "2023-12-31T16:00:00Z",
                "Value": 0
            },
            {
                "Time": "2024-01-01T16:00:00Z",
                "Value": 0
            },
            {
                "Time": "2024-01-02T16:00:00Z",
                "Value": 0
            },
            {
                "Time": "2024-01-03T16:00:00Z",
                "Value": 0
            },
            {
                "Time": "2024-01-04T16:00:00Z",
                "Value": 0
            },
            {
                "Time": "2024-01-05T16:00:00Z",
                "Value": 0
            },
            {
                "Time": "2024-01-06T16:00:00Z",
                "Value": 0
            },
            {
                "Time": "2024-01-07T16:00:00Z",
                "Value": 0
            },
            {
                "Time": "2024-01-08T16:00:00Z",
                "Value": 0
            },
            {
                "Time": "2024-01-09T16:00:00Z",
                "Value": 0
            },
            {
                "Time": "2024-01-10T16:00:00Z",
                "Value": 0
            },
            {
                "Time": "2024-01-11T16:00:00Z",
                "Value": 0
            },
            {
                "Time": "2024-01-12T16:00:00Z",
                "Value": 0
            },
            {
                "Time": "2024-01-13T16:00:00Z",
                "Value": 0
            },
            {
                "Time": "2024-01-14T16:00:00Z",
                "Value": 0
            },
            {
                "Time": "2024-01-15T16:00:00Z",
                "Value": 0
            },
            {
                "Time": "2024-01-16T16:00:00Z",
                "Value": 0
            },
            {
                "Time": "2024-01-17T16:00:00Z",
                "Value": 0
            },
            {
                "Time": "2024-01-18T16:00:00Z",
                "Value": 0
            },
            {
                "Time": "2024-01-19T16:00:00Z",
                "Value": 0
            },
            {
                "Time": "2024-01-20T16:00:00Z",
                "Value": 0
            },
            {
                "Time": "2024-01-21T16:00:00Z",
                "Value": 0
            },
            {
                "Time": "2024-01-22T16:00:00Z",
                "Value": 0
            },
            {
                "Time": "2024-01-23T16:00:00Z",
                "Value": 0
            }
        ]
    }
}
```

### 示例2 查询指定站点的内容加速流量，并按照站点 ID 分组

查询指定 zone-id 的内容加速流量计费用量，并按照 zone-id 进行分组，查询时间粒度为天。

#### 输入示例

```
POST / HTTP/1.1
Host: teo.tencentcloudapi.com
Content-Type: application/json
X-TC-Action: DescribeBillingData
<公共请求参数>

{
    "StartTime": "2025-07-01T00:00:00+08:00",
    "EndTime": "2025-07-02T23:59:59+08:00",
    "Interval": "day",
    "MetricName": "acc_flux",
    "ZoneIds": [
        "zone-2m2gq4dnpmd2",
        "zone-30hqppzribht"
    ],
    "GroupBy": [
        "zone-id"
    ]
}
```

#### 输出示例

```json
{
    "Response": {
        "RequestId": "d2174285-8aac-4cdc-bc06-d81f2f6520da",
        "Data": [
            {
                "Time": "2025-06-30T16:00:00Z",
                "Value": 0,
                "ZoneId": "zone-2m2gq4dnpmd2"
            },
            {
                "Time": "2025-07-01T16:00:00Z",
                "Value": 2751240612,
                "ZoneId": "zone-2m2gq4dnpmd2"
            },
            {
                "Time": "2025-06-30T16:00:00Z",
                "Value": 0,
                "ZoneId": "zone-30hqppzribht"
            },
            {
                "Time": "2025-07-01T16:00:00Z",
                "Value": 68443435,
                "ZoneId": "zone-30hqppzribht"
            }
        ]
    }
}
```

### 示例3 查询指定站点的内容加速流量，并按照域名分组

查询指定 zone-id 的内容加速流量计费用量，并按照域名进行分组，查询时间粒度为天。

#### 输入示例

```
POST / HTTP/1.1
Host: teo.tencentcloudapi.com
Content-Type: application/json
X-TC-Action: DescribeBillingData
<公共请求参数>

{
    "StartTime": "2025-07-01T00:00:00+08:00",
    "EndTime": "2025-07-02T23:59:59+08:00",
    "Interval": "day",
    "MetricName": "acc_flux",
    "ZoneIds": [
        "zone-2m2gq4dnpmd2",
        "zone-30hqppzribht"
    ],
    "GroupBy": [
        "host"
    ]
}
```

#### 输出示例

```json
{
    "Response": {
        "RequestId": "d2174285-8aac-4cdc-bc06-d81f2f6520da",
        "Data": [
            {
                "Host": "test1.example.com",
                "Time": "2025-06-30T16:00:00Z",
                "Value": 1387001003,
                "ZoneId": "zone-2m2gq4dnpmd2"
            },
            {
                "Host": "test1.example.com",
                "Time": "2025-07-01T16:00:00Z",
                "Value": 1390529805,
                "ZoneId": "zone-2m2gq4dnpmd2"
            },
            {
                "Host": "test2.example.com",
                "Time": "2025-06-30T16:00:00Z",
                "Value": 2879078,
                "ZoneId": "zone-2m2gq4dnpmd2"
            },
            {
                "Host": "test2.example.com",
                "Time": "2025-07-01T16:00:00Z",
                "Value": 2889084,
                "ZoneId": "zone-2m2gq4dnpmd2"
            }
        ]
    }
}
```

### 示例4 查询指定站点的内容加速流量，并按照站点 ID 和计费大区分组

查询指定 zone-id 的内容加速流量计费用量，并按照 zone-id 和计费大区进行分组，查询时间粒度为天。

#### 输入示例

```
POST / HTTP/1.1
Host: teo.tencentcloudapi.com
Content-Type: application/json
X-TC-Action: DescribeBillingData
<公共请求参数>

{
    "StartTime": "2025-07-01T00:00:00+08:00",
    "EndTime": "2025-07-02T23:59:59+08:00",
    "Interval": "day",
    "MetricName": "acc_flux",
    "ZoneIds": [
        "zone-2m2gq4dnpmd2",
        "zone-30hqppzribht"
    ],
    "GroupBy": [
        "zone-id",
        "region-id"
    ]
}
```

#### 输出示例

```json
{
    "Response": {
        "RequestId": "d2174285-8aac-4cdc-bc06-d81f2f6520da",
        "Data": [
            {
                "RegionId": "SA",
                "Time": "2025-06-30T16:00:00Z",
                "Value": 549591531,
                "ZoneId": "zone-2m2gq4dnpmd2"
            },
            {
                "RegionId": "SA",
                "Time": "2025-07-01T16:00:00Z",
                "Value": 549591531,
                "ZoneId": "zone-2m2gq4dnpmd2"
            },
            {
                "RegionId": "MidEast",
                "Time": "2025-06-30T16:00:00Z",
                "Value": 549591531,
                "ZoneId": "zone-30hqppzribht"
            },
            {
                "RegionId": "MidEast",
                "Time": "2025-07-01T16:00:00Z",
                "Value": 549591531,
                "ZoneId": "zone-30hqppzribht"
            }
        ]
    }
}
```


## 5. 开发者资源

### 腾讯云 API 平台

[腾讯云 API 平台](https://cloud.tencent.com/api) 是综合 API 文档、错误码、API Explorer 及 SDK 等资源的统一查询平台，方便您从同一入口查询及使用腾讯云提供的所有 API 服务。

### API Inspector

用户可通过 [API Inspector](https://cloud.tencent.com/document/product/1278/49361) 查看控制台每一步操作关联的 API 调用情况，并自动生成各语言版本的 API 代码，也可前往 [API Explorer](https://cloud.tencent.com/document/product/1278/46697) 进行在线调试。

### SDK

云 API 3.0 提供了配套的开发工具集（SDK），支持多种编程语言，能更方便的调用 API。
* Tencent Cloud SDK 3.0 for Python: [CNB](https://cnb.cool/tencent/cloud/api/sdk/tencentcloud-sdk-python/-/blob/master/tencentcloud/teo/v20220901/teo_client.py), [GitHub](https://github.com/TencentCloud/tencentcloud-sdk-python/blob/master/tencentcloud/teo/v20220901/teo_client.py), [Gitee](https://gitee.com/TencentCloud/tencentcloud-sdk-python/blob/master/tencentcloud/teo/v20220901/teo_client.py)
* Tencent Cloud SDK 3.0 for Java: [CNB](https://cnb.cool/tencent/cloud/api/sdk/tencentcloud-sdk-java/-/blob/master/src/main/java/com/tencentcloudapi/teo/v20220901/TeoClient.java), [GitHub](https://github.com/TencentCloud/tencentcloud-sdk-java/blob/master/src/main/java/com/tencentcloudapi/teo/v20220901/TeoClient.java), [Gitee](https://gitee.com/TencentCloud/tencentcloud-sdk-java/blob/master/src/main/java/com/tencentcloudapi/teo/v20220901/TeoClient.java)
* Tencent Cloud SDK 3.0 for PHP: [CNB](https://cnb.cool/tencent/cloud/api/sdk/tencentcloud-sdk-php/-/blob/master/src/TencentCloud/Teo/V20220901/TeoClient.php), [GitHub](https://github.com/TencentCloud/tencentcloud-sdk-php/blob/master/src/TencentCloud/Teo/V20220901/TeoClient.php), [Gitee](https://gitee.com/TencentCloud/tencentcloud-sdk-php/blob/master/src/TencentCloud/Teo/V20220901/TeoClient.php)
* Tencent Cloud SDK 3.0 for Go: [CNB](https://cnb.cool/tencent/cloud/api/sdk/tencentcloud-sdk-go/-/blob/master/tencentcloud/teo/v20220901/client.go), [GitHub](https://github.com/TencentCloud/tencentcloud-sdk-go/blob/master/tencentcloud/teo/v20220901/client.go), [Gitee](https://gitee.com/TencentCloud/tencentcloud-sdk-go/blob/master/tencentcloud/teo/v20220901/client.go)
* Tencent Cloud SDK 3.0 for Node.js: [CNB](https://cnb.cool/tencent/cloud/api/sdk/tencentcloud-sdk-nodejs/-/blob/master/src/services/teo/v20220901/teo_client.ts), [GitHub](https://github.com/TencentCloud/tencentcloud-sdk-nodejs/blob/master/src/services/teo/v20220901/teo_client.ts), [Gitee](https://gitee.com/TencentCloud/tencentcloud-sdk-nodejs/blob/master/src/services/teo/v20220901/teo_client.ts)
* Tencent Cloud SDK 3.0 for .NET: [CNB](https://cnb.cool/tencent/cloud/api/sdk/tencentcloud-sdk-dotnet/-/blob/master/TencentCloud/Teo/V20220901/TeoClient.cs), [GitHub](https://github.com/TencentCloud/tencentcloud-sdk-dotnet/blob/master/TencentCloud/Teo/V20220901/TeoClient.cs), [Gitee](https://gitee.com/TencentCloud/tencentcloud-sdk-dotnet/blob/master/TencentCloud/Teo/V20220901/TeoClient.cs)
* Tencent Cloud SDK 3.0 for C++: [CNB](https://cnb.cool/tencent/cloud/api/sdk/tencentcloud-sdk-cpp/-/blob/master/teo/src/v20220901/TeoClient.cpp), [GitHub](https://github.com/TencentCloud/tencentcloud-sdk-cpp/blob/master/teo/src/v20220901/TeoClient.cpp), [Gitee](https://gitee.com/TencentCloud/tencentcloud-sdk-cpp/blob/master/teo/src/v20220901/TeoClient.cpp)
* Tencent Cloud SDK 3.0 for Ruby: [CNB](https://cnb.cool/tencent/cloud/api/sdk/tencentcloud-sdk-ruby/-/blob/master/tencentcloud-sdk-teo/lib/v20220901/client.rb), [GitHub](https://github.com/TencentCloud/tencentcloud-sdk-ruby/blob/master/tencentcloud-sdk-teo/lib/v20220901/client.rb), [Gitee](https://gitee.com/TencentCloud/tencentcloud-sdk-ruby/blob/master/tencentcloud-sdk-teo/lib/v20220901/client.rb)

### 命令行工具

* [Tencent Cloud CLI 3.0](https://cloud.tencent.com/document/product/440/6176)

## 6. 错误码

以下仅列出了接口业务逻辑相关的错误码，其他错误码详见 [公共错误码](/document/api/1552/80729#.E5.85.AC.E5.85.B1.E9.94.99.E8.AF.AF.E7.A0.81)。

| 错误码 | 描述 |
|---------|---------|
| InternalError.ProxyServer | 后端服务器发生未知错误。 |
| InvalidParameter.GroupByLimitExceeded | GroupBy参数超过数量限制。 |
| InvalidParameter.InvalidInterval | 无效时间间隔。取值应为[min 5min hour day]。 |
| InvalidParameter.InvalidMetric | 无效查询维度。 |
| InvalidParameter.ZoneHasNotBeenBoundToPlan | 站点未绑定套餐。 |
