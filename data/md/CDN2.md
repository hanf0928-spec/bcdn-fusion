# CDN

> v1.0.0

Base URLs:

## 鉴权方式

1. 向客服申请一个ApiKey

2. 在所有接口调用时将ApiKey 放到名为Authorization的header 头中

# api管理

<a id="opIdbsStatisticsUsingGET"></a>

## GET 回源统计图

GET /api/v1.0/domain/bs-statistics

### 请求参数

| 名称          | 位置    | 类型            | 必选  | 说明                               |
| ----------- | ----- | ------------- | --- | -------------------------------- |
| domainNames | query | array[string] | 否   | 筛选域名列表                           |
| endTime     | query | integer       | 是   | 结束时间，必须要是东八区一天结束的时间戳             |
| interval    | query | integer       | 是   | 间隔 ，取值300：五分钟，3600：一小时，14400 四小时 |
| startTime   | query | integer       | 是   | 开始时间，必须要是东八区一天开始的时间戳             |

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "data": {
    "maxBw": 0,
    "totalFlux": 0,
    "bw": [
      0
    ],
    "endTime": 0,
    "flux": [
      0
    ],
    "interval": 0,
    "startTime": 0
  }
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称           | 类型                                                      | 必选    | 约束   | 中文名                    | 说明   |
| ------------ | ------------------------------------------------------- | ----- | ---- | ---------------------- | ---- |
| » code       | integer                                                 | true  | none |                        | 200  |
| » msg        | string                                                  | true  | none |                        | none |
| » data       | [DomainStatisticsResult](#schemadomainstatisticsresult) | true  | none | DomainStatisticsResult | none |
| »»maxBw      | [integer]                                               | true  |      |                        | 最高带宽 |
| »»totalFlux  | [integer]                                               | true  |      |                        | 总流量  |
| »» bw        | [integer]                                               | false | none |                        | 带宽   |
| »» endTime   | integer(int64)                                          | false | none |                        | none |
| »» flux      | [integer]                                               | false | none |                        | 流量   |
| »» interval  | integer(int64)                                          | false | none |                        | none |
| »» startTime | integer(int64)                                          | false | none |                        | none |

 

## GET ## 流量统计图

GET /api/v1.0/domain/domain-statistics

### 请求参数

| 名称          | 位置    | 类型            | 必选  | 说明                               |
| ----------- | ----- | ------------- | --- | -------------------------------- |
| domainNames | query | array[string] | 否   | 筛选域名列表                           |
| endTime     | query | integer       | 是   | 结束时间，必须要是东八区一天结束的时间戳             |
| interval    | query | integer       | 是   | 间隔 ，取值300：五分钟，3600：一小时，14400 四小时 |
| startTime   | query | integer       | 是   | 开始时间，必须要是东八区一天开始的时间戳             |

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "data": {
    "maxBw": 0,
    "totalFlux": 0,
    "bw": [
      0
    ],
    "endTime": 0,
    "flux": [
      0
    ],
    "interval": 0,
    "startTime": 0
  }
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称           | 类型                                                      | 必选    | 约束   | 中文名                    | 说明   |
| ------------ | ------------------------------------------------------- | ----- | ---- | ---------------------- | ---- |
| » code       | integer                                                 | true  | none |                        | 200  |
| » msg        | string                                                  | true  | none |                        | none |
| » data       | [DomainStatisticsResult](#schemadomainstatisticsresult) | true  | none | DomainStatisticsResult | none |
| »»maxBw      | [integer]                                               | true  |      |                        | 最高带宽 |
| »»totalFlux  | [integer]                                               | true  |      |                        | 总流量  |
| »» bw        | [integer]                                               | false | none |                        | 带宽   |
| »» endTime   | integer(int64)                                          | false | none |                        | none |
| »» flux      | [integer]                                               | false | none |                        | 流量   |
| »» interval  | integer(int64)                                          | false | none |                        | none |
| »» startTime | integer(int64)                                          | false | none |                        | none |

<a id="opIdlistUsingGET_4"></a>

## GET 获取预热刷新列表

GET /api/v1.0/domain/content/list

分页查询刷新预热列表

### 请求参数

| 名称   | 位置    | 类型      | 必选  | 说明   |
| ---- | ----- | ------- | --- | ---- |
| page | query | integer | 否   | page |
| size | query | integer | 否   | size |

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "data": [
    {
      "createDate": "2019-08-24T14:15:22Z",
      "id": "string",
      "modifyDate": "2019-08-24T14:15:22Z",
      "state": "FAIL",
      "task": {
        "type": "file 或directory,默认为file",
        "urls": [
          "string"
        ]
      },
      "taskInfos": [
        {
          "state": "FAIL",
          "url": "string"
        }
      ],
      "type": "PREHEATING"
    }
  ]
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称                           | 类型                                                              | 必选    | 约束   | 中文名                       | 说明       |
| ---------------------------- | --------------------------------------------------------------- | ----- | ---- | ------------------------- | -------- |
| » code                       | integer                                                         | true  | none |                           | 200      |
| » msg                        | string                                                          | true  | none |                           | none     |
| » data                       | [[PreheatingOrRefreshResult](#schemapreheatingorrefreshresult)] | true  | none |                           | none     |
| »» PreheatingOrRefreshResult | [PreheatingOrRefreshResult](#schemapreheatingorrefreshresult)   | false | none | PreheatingOrRefreshResult | none     |
| »»» createDate               | string(date-time)                                               | false | none |                           | 任务执行时间   |
| »»» id                       | string                                                          | false | none |                           | none     |
| »»» modifyDate               | string(date-time)                                               | false | none |                           | none     |
| »»» state                    | string                                                          | false | none |                           | 任务执行状态   |
| »»» task                     | [Task](#schematask)                                             | false | none | Task                      | none     |
| »»»» type                    | string                                                          | false | none |                           | 预热刷新路径类型 |
| »»»» urls                    | [string]                                                        | false | none |                           | 预热刷新的路径  |
| »»» taskInfos                | [[TaskInfo](#schemataskinfo)]                                   | false | none |                           | 任务执行详情   |
| »»»» TaskInfo                | [TaskInfo](#schemataskinfo)                                     | false | none | TaskInfo                  | none     |
| »»»»» state                  | string                                                          | false | none |                           | 任务状态     |
| »»»»» url                    | string                                                          | false | none |                           | none     |
| »»» type                     | string                                                          | false | none |                           | 任务类型     |

#### 枚举值

| 属性    | 值          |
| ----- | ---------- |
| state | FAIL       |
| state | PROCESSING |
| state | SUCCESS    |
| state | FAIL       |
| state | PROCESSING |
| state | SUCCESS    |
| type  | PREHEATING |
| type  | REFRESH    |

<a id="opIdpreheatingUsingPOST"></a>

## POST 预热任务

POST /api/v1.0/domain/content/preheating-tasks

预热任务

> Body 请求参数

```json
{
  "type": "file 或directory,默认为file",
  "urls": [
    "string"
  ]
}
```

### 请求参数

| 名称   | 位置   | 类型                  | 必选  | 中文名  | 说明   |
| ---- | ---- | ------------------- | --- | ---- | ---- |
| body | body | [Task](#schematask) | 否   | Task | none |

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "property1": {},
  "property2": {}
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称                         | 类型      | 必选    | 约束   | 中文名 | 说明   |
| -------------------------- | ------- | ----- | ---- | --- | ---- |
| » **additionalProperties** | object  | false | none |     | none |
| » code                     | integer | true  | none |     | 200  |
| » msg                      | string  | true  | none |     | 任务id |

<a id="opIdrefreshUsingPOST"></a>

## POST 刷新任务

POST /api/v1.0/domain/content/refresh-tasks

刷新任务

> Body 请求参数

```json
{
  "type": "file 或directory,默认为file",
  "urls": [
    "string"
  ]
}
```

### 请求参数

| 名称   | 位置   | 类型                  | 必选  | 中文名  | 说明   |
| ---- | ---- | ------------------- | --- | ---- | ---- |
| body | body | [Task](#schematask) | 否   | Task | none |

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "property1": {},
  "property2": {}
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称                         | 类型      | 必选    | 约束   | 中文名 | 说明   |
| -------------------------- | ------- | ----- | ---- | --- | ---- |
| » **additionalProperties** | object  | false | none |     | none |
| » code                     | integer | true  | none |     | 200  |
| » msg                      | string  | true  | none |     | 任务id |

<a id="opIdgetUsingGET"></a>

## GET 获取预热刷新任务

GET /api/v1.0/domain/content/{id}

查询刷新预热详情

### 请求参数

| 名称  | 位置   | 类型     | 必选  | 中文名 | 说明   |
| --- | ---- | ------ | --- | --- | ---- |
| id  | path | string | 是   |     | 任务id |

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "data": {
    "createDate": "2019-08-24T14:15:22Z",
    "id": "string",
    "modifyDate": "2019-08-24T14:15:22Z",
    "state": "FAIL",
    "task": {
      "type": "file 或directory,默认为file",
      "urls": [
        "string"
      ]
    },
    "taskInfos": [
      {
        "state": "FAIL",
        "url": "string"
      }
    ],
    "type": "PREHEATING"
  }
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称            | 类型                                                            | 必选    | 约束   | 中文名                       | 说明       |
| ------------- | ------------------------------------------------------------- | ----- | ---- | ------------------------- | -------- |
| » code        | integer                                                       | true  | none |                           | 200      |
| » msg         | string                                                        | true  | none |                           | none     |
| » data        | [PreheatingOrRefreshResult](#schemapreheatingorrefreshresult) | true  | none | PreheatingOrRefreshResult | none     |
| »» createDate | string(date-time)                                             | false | none |                           | 任务执行时间   |
| »» id         | string                                                        | false | none |                           | none     |
| »» modifyDate | string(date-time)                                             | false | none |                           | none     |
| »» state      | string                                                        | false | none |                           | 任务执行状态   |
| »» task       | [Task](#schematask)                                           | false | none | Task                      | none     |
| »»» type      | string                                                        | false | none |                           | 预热刷新路径类型 |
| »»» urls      | [string]                                                      | false | none |                           | 预热刷新的路径  |
| »» taskInfos  | [[TaskInfo](#schemataskinfo)]                                 | false | none |                           | 任务执行详情   |
| »»» TaskInfo  | [TaskInfo](#schemataskinfo)                                   | false | none | TaskInfo                  | none     |
| »»»» state    | string                                                        | false | none |                           | 任务状态     |
| »»»» url      | string                                                        | false | none |                           | none     |
| »» type       | string                                                        | false | none |                           | 任务类型     |

#### 枚举值

| 属性    | 值          |
| ----- | ---------- |
| state | FAIL       |
| state | PROCESSING |
| state | SUCCESS    |
| state | FAIL       |
| state | PROCESSING |
| state | SUCCESS    |
| type  | PREHEATING |
| type  | REFRESH    |

<a id="opIdcreateUsingPOST_5"></a>

## POST 创建域名

POST /api/v1.0/domain/create

> Body 请求参数

```json
{
  "businessType": "网页:web/下载:download/视频:video",
  "domainName": "string",
  "sources": [
    {
      "hostName": "string",
      "httpPort": 80,
      "httpsPort": 443,
      "ipOrDomain": "string",
      "originType": "ipaddr/domain"
    }
  ]
}
```

### 请求参数

| 名称   | 位置   | 类型                                                | 必选  | 中文名                 | 说明   |
| ---- | ---- | ------------------------------------------------- | --- | ------------------- | ---- |
| body | body | [DomainCreateCommand](#schemadomaincreatecommand) | 否   | DomainCreateCommand | none |

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "data": {
    "accountType": "ALIYUN",
    "businessType": "网页:web/下载:download/视频:video",
    "cname": "string",
    "createDate": "2019-08-24T14:15:22Z",
    "disabled": 0,
    "domainConfig": {
      "cacheConfig": {
        "compress": 0,
        "followOrigin": true,
        "ignoreUrlParameter": true,
        "rules": [
          {
            "content": "string",
            "priority": 0,
            "ruleType": 0,
            "ttl": 0,
            "ttlType": 0
          }
        ]
      },
      "certificateId": "string",
      "forceRedirect": {
        "status": "on/off",
        "type": "http/https/"
      },
      "httpResponseHeader": [
        {
          "action": "[",
          "name": "string",
          "value": "string"
        }
      ],
      "https": {
        "certName": "string",
        "certificate": "string",
        "expirationTime": 0,
        "httpsStatus": "off",
        "privateKey": "string"
      },
      "ipFilter": {
        "list": [
          "string"
        ],
        "type": 0
      },
      "originProtocol": "string",
      "originRequestHeader": [
        {
          "action": "[",
          "name": "string",
          "value": "string"
        }
      ],
      "rangeStatus": "on/off",
      "referer": {
        "includeEmpty": true,
        "refererList": "string",
        "refererType": 0
      },
      "sources": [
        {
          "hostName": "string",
          "httpPort": "[",
          "httpsPort": "[",
          "ipOrDomain": "string",
          "originType": "["
        }
      ],
      "urlAuth": {
        "backupKey": "string",
        "expireTime": 0,
        "key": "string",
        "signArg": "string",
        "status": "on/off",
        "type": "type_a"
      }
    },
    "domainName": "string",
    "domainUserId": "string",
    "id": "string",
    "locked": 0,
    "modifyDate": "2019-08-24T14:15:22Z",
    "serviceArea": "global",
    "sourceDomainStatus": "string",
    "state": "创建中:CREATING, 创建成功:CREATED, 停用:DISABLE, 配置中:CONFIGURING, 异常:ABNORMAL, 删除中:DELETING"
  }
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称                       | 类型                                                    | 必选    | 约束   | 中文名                 | 说明                                                             |
| ------------------------ | ----------------------------------------------------- | ----- | ---- | ------------------- | -------------------------------------------------------------- |
| » code                   | integer                                               | true  | none |                     | 200                                                            |
| » msg                    | string                                                | true  | none |                     | none                                                           |
| » data                   | [DomainResult](#schemadomainresult)                   | true  | none | DomainResult        | none                                                           |
| »» accountType           | string                                                | false | none |                     | none                                                           |
| »» businessType          | string                                                | false | none |                     | 加速类型                                                           |
| »» cname                 | string                                                | false | none |                     | 加速cname                                                        |
| »» createDate            | string(date-time)                                     | false | none |                     | 创建时间                                                           |
| »» disabled              | integer(int32)                                        | false | none |                     | 是否禁用                                                           |
| »» domainConfig          | [DomainConfig](#schemadomainconfig)                   | false | none | DomainConfig        | 详细配置                                                           |
| »»» cacheConfig          | [CacheConfig](#schemacacheconfig)                     | false | none | CacheConfig         | 缓存配置                                                           |
| »»»» compress            | integer(int32)                                        | false | none |                     | 是否开启压缩                                                         |
| »»»» followOrigin        | boolean                                               | false | none |                     | 是否跟随源站                                                         |
| »»»» ignoreUrlParameter  | boolean                                               | false | none |                     | 是否忽略url参数                                                      |
| »»»» rules               | [[缓存规则](#schema%e7%bc%93%e5%ad%98%e8%a7%84%e5%88%99)] | false | none |                     | 缓存规则                                                           |
| »»» certificateId        | string                                                | false | none |                     | none                                                           |
| »»» forceRedirect        | [ForceRedirect](#schemaforceredirect)                 | false | none | ForceRedirect       | 重定向                                                            |
| »»»» status              | string                                                | false | none |                     | 开关状态                                                           |
| »»»» type                | string                                                | false | none |                     | 重定向类型                                                          |
| »»» httpResponseHeader   | [[HttpResponseHeader](#schemahttpresponseheader)]     | false | none |                     | 自定义响应头                                                         |
| »»»» HttpResponseHeader  | [HttpResponseHeader](#schemahttpresponseheader)       | false | none | HttpResponseHeader  | none                                                           |
| »»»»» action             | string                                                | false | none |                     | 操作类型                                                           |
| »»»»» name               | string                                                | false | none |                     | 名称                                                             |
| »»»»» value              | string                                                | false | none |                     | 值                                                              |
| »»» https                | [HttpsInfo](#schemahttpsinfo)                         | false | none | HttpsInfo           | none                                                           |
| »»»» certName            | string                                                | false | none |                     | 证书名称                                                           |
| »»»» certificate         | string                                                | false | none |                     | 公钥                                                             |
| »»»» expirationTime      | integer(int64)                                        | false | none |                     | 域名有效期                                                          |
| »»»» httpsStatus         | string                                                | false | none |                     | 是否开启https                                                      |
| »»»» privateKey          | string                                                | false | none |                     | 私钥                                                             |
| »»» ipFilter             | [IpFilter](#schemaipfilter)                           | false | none | IpFilter            | none                                                           |
| »»»» list                | [string]                                              | false | none |                     | ip列表                                                           |
| »»»» type                | integer(int32)                                        | false | none |                     | IP黑白名单类型（0：关闭IP黑白名单功能，1：黑名单，2：白名单）                             |
| »»» originProtocol       | string                                                | false | none |                     | 回原协议，取值：follow/http/https                                      |
| »»» originRequestHeader  | [[OriginRequestHeader](#schemaoriginrequestheader)]   | false | none |                     | 回原请求头                                                          |
| »»»» OriginRequestHeader | [OriginRequestHeader](#schemaoriginrequestheader)     | false | none | OriginRequestHeader | none                                                           |
| »»»»» action             | string                                                | false | none |                     | 操作类型                                                           |
| »»»»» name               | string                                                | false | none |                     | 名称                                                             |
| »»»»» value              | string                                                | false | none |                     | 值                                                              |
| »»» rangeStatus          | string                                                | false | none |                     | range 开关                                                       |
| »»» referer              | [Referer](#schemareferer)                             | false | none | Referer             | none                                                           |
| »»»» includeEmpty        | boolean                                               | false | none |                     | 是否支持空referer                                                   |
| »»»» refererList         | string                                                | false | none |                     | 请输入域名或IP地址，以“;”进行分割，域名、IP地址可以混合输入，支持泛域名添加。输入的域名、IP地址总数不超过100个。 |
| »»»» refererType         | integer(int32)                                        | false | none |                     | Referer类型。取值：0代表不设置Referer过滤；1代表黑名单；2代表白名单。默认取值为0              |
| »»» sources              | [[ConfigSources](#schemaconfigsources)]               | false | none |                     | 回原配置                                                           |
| »»»» ConfigSources       | [ConfigSources](#schemaconfigsources)                 | false | none | ConfigSources       | none                                                           |
| »»»»» hostName           | string                                                | false | none |                     | 回原host                                                         |
| »»»»» httpPort           | integer(int32)                                        | false | none |                     | http 端口                                                        |
| »»»»» httpsPort          | integer(int32)                                        | false | none |                     | https 端口                                                       |
| »»»»» ipOrDomain         | string                                                | false | none |                     | 回原ip或回原域名                                                      |
| »»»»» originType         | string                                                | false | none |                     | 加速域名回原地址类型                                                     |
| »»» urlAuth              | [UrlAuth](#schemaurlauth)                             | false | none | UrlAuth             | none                                                           |
| »»»» backupKey           | string                                                | false | none |                     | 备用key，非必填                                                      |
| »»»» expireTime          | integer(int32)                                        | false | none |                     | 有效期                                                            |
| »»»» key                 | string                                                | false | none |                     | key                                                            |
| »»»» signArg             | string                                                | false | none |                     | 鉴权参数：1-100位可以由大小写字母、数字、下划线构成（不能以数字开头）                          |
| »»»» status              | string                                                | false | none |                     | 开关状态                                                           |
| »»»» type                | string                                                | false | none |                     | none                                                           |
| »» domainName            | string                                                | false | none |                     | 域名                                                             |
| »» domainUserId          | string                                                | false | none |                     | none                                                           |
| »» id                    | string                                                | false | none |                     | none                                                           |
| »» locked                | integer(int32)                                        | false | none |                     | none                                                           |
| »» modifyDate            | string(date-time)                                     | false | none |                     | 最后修改时间                                                         |
| »» serviceArea           | string                                                | false | none |                     | none                                                           |
| »» sourceDomainStatus    | string                                                | false | none |                     | none                                                           |
| »» state                 | string                                                | false | none |                     | 域名状态                                                           |

#### 枚举值

| 属性           | 值                      |
| ------------ | ---------------------- |
| accountType  | ALIYUN                 |
| accountType  | HUAWEI                 |
| accountType  | TENCENT                |
| accountType  | VOLC                   |
| businessType | download               |
| businessType | video                  |
| businessType | web                    |
| status       | off                    |
| status       | on                     |
| httpsStatus  | off                    |
| httpsStatus  | on                     |
| rangeStatus  | off                    |
| rangeStatus  | on                     |
| originType   | domain                 |
| originType   | ipaddr                 |
| status       | off                    |
| status       | on                     |
| type         | type_a                 |
| type         | type_b                 |
| serviceArea  | global                 |
| serviceArea  | mainland_china         |
| serviceArea  | outside_mainland_china |
| state        | CREATED                |
| state        | CREATING               |
| state        | DELETE                 |
| state        | DISABLE                |

<a id="opIddeleteUsingPOST_4"></a>

## POST 删除域名

POST /api/v1.0/domain/delete

删除域名

> Body 请求参数

```json
[
  "string"
]
```

### 请求参数

| 名称   | 位置   | 类型            | 必选  | 中文名 | 说明   |
| ---- | ---- | ------------- | --- | --- | ---- |
| body | body | array[string] | 否   |     | none |

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "data": true
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称     | 类型      | 必选   | 约束   | 中文名 | 说明   |
| ------ | ------- | ---- | ---- | --- | ---- |
| » code | integer | true | none |     | 200  |
| » msg  | string  | true | none |     | none |
| » data | boolean | true | none |     | none |

<a id="opIddisableUsingPOST_1"></a>

## POST 禁用域名

POST /api/v1.0/domain/disable

> Body 请求参数

```json
[
  "string"
]
```

### 请求参数

| 名称   | 位置   | 类型            | 必选  | 中文名 | 说明   |
| ---- | ---- | ------------- | --- | --- | ---- |
| body | body | array[string] | 否   |     | none |

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "data": true
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称     | 类型      | 必选   | 约束   | 中文名 | 说明   |
| ------ | ------- | ---- | ---- | --- | ---- |
| » code | integer | true | none |     | 200  |
| » msg  | string  | true | none |     | none |
| » data | boolean | true | none |     | none |

<a id="opIdmyPlanUsingGET"></a>

## GET 流量统计图

GET /api/v1.0/domain/domain-statistics

### 请求参数

| 名称          | 位置    | 类型            | 必选  | 中文名 | 说明                               |
| ----------- | ----- | ------------- | --- | --- | -------------------------------- |
| domainNames | query | array[string] | 否   |     | 筛选域名列表                           |
| endTime     | query | integer       | 是   |     | 结束时间，必须要是东八区一天结束的时间戳             |
| interval    | query | integer       | 是   |     | 间隔 ，取值300：五分钟，3600：一小时，14400 四小时 |
| startTime   | query | integer       | 是   |     | 开始时间，必须要是东八区一天开始的时间戳             |

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "data": {
    "bw": [
      0
    ],
    "endTime": 0,
    "flux": [
      0
    ],
    "interval": 0,
    "startTime": 0
  }
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称           | 类型                                                      | 必选    | 约束   | 中文名                    | 说明   |
| ------------ | ------------------------------------------------------- | ----- | ---- | ---------------------- | ---- |
| » code       | integer                                                 | true  | none |                        | 200  |
| » msg        | string                                                  | true  | none |                        | none |
| » data       | [DomainStatisticsResult](#schemadomainstatisticsresult) | true  | none | DomainStatisticsResult | none |
| »» bw        | [integer]                                               | false | none |                        | 带宽   |
| »» endTime   | integer(int64)                                          | false | none |                        | none |
| »» flux      | [integer]                                               | false | none |                        | 流量   |
| »» interval  | integer(int64)                                          | false | none |                        | none |
| »» startTime | integer(int64)                                          | false | none |                        | none |

<a id="opIdenableUsingPOST_1"></a>

## POST 激活域名

POST /api/v1.0/domain/enable

> Body 请求参数

```json
[
  "string"
]
```

### 请求参数

| 名称   | 位置   | 类型            | 必选  | 中文名 | 说明   |
| ---- | ---- | ------------- | --- | --- | ---- |
| body | body | array[string] | 否   |     | none |

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "data": true
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称     | 类型      | 必选   | 约束   | 中文名 | 说明   |
| ------ | ------- | ---- | ---- | --- | ---- |
| » code | integer | true | none |     | 200  |
| » msg  | string  | true | none |     | none |
| » data | boolean | true | none |     | none |

<a id="opIdlimitUsingGET_1"></a>

## GET 剩余可创建域名数

GET /api/v1.0/domain/limit

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "data": 0
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称     | 类型      | 必选   | 约束   | 中文名 | 说明        |
| ------ | ------- | ---- | ---- | --- | --------- |
| » code | integer | true | none |     | 200       |
| » msg  | string  | true | none |     | none      |
| » data | integer | true | none |     | 剩余可创建域名数量 |

<a id="opIdlistUsingGET_3"></a>

## GET 分页查询我的域名列表

GET /api/v1.0/domain/list

### 请求参数

| 名称         | 位置    | 类型      | 必选  | 中文名 | 说明     |
| ---------- | ----- | ------- | --- | --- | ------ |
| domainName | query | string  | 否   |     | 筛选域名   |
| page       | query | integer | 否   |     | 页数，默认1 |
| size       | query | integer | 否   |     | 每页数量   |

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "data": [
    {
      "accountType": "ALIYUN",
      "businessType": "网页:web/下载:download/视频:video",
      "cname": "string",
      "createDate": "2019-08-24T14:15:22Z",
      "disabled": 0,
      "domainConfig": {
        "cacheConfig": {
          "compress": 0,
          "followOrigin": true,
          "ignoreUrlParameter": true,
          "rules": [
            null
          ]
        },
        "certificateId": "string",
        "forceRedirect": {
          "status": "[",
          "type": "["
        },
        "httpResponseHeader": [
          {
            "action": null,
            "name": null,
            "value": null
          }
        ],
        "https": {
          "certName": "string",
          "certificate": "string",
          "expirationTime": 0,
          "httpsStatus": "[",
          "privateKey": "string"
        },
        "ipFilter": {
          "list": [
            null
          ],
          "type": 0
        },
        "originProtocol": "string",
        "originRequestHeader": [
          {
            "action": null,
            "name": null,
            "value": null
          }
        ],
        "rangeStatus": "on/off",
        "referer": {
          "includeEmpty": true,
          "refererList": "string",
          "refererType": 0
        },
        "sources": [
          {
            "hostName": null,
            "httpPort": null,
            "httpsPort": null,
            "ipOrDomain": null,
            "originType": null
          }
        ],
        "urlAuth": {
          "backupKey": "string",
          "expireTime": 0,
          "key": "string",
          "signArg": "string",
          "status": "[",
          "type": "["
        }
      },
      "domainName": "string",
      "domainUserId": "string",
      "id": "string",
      "locked": 0,
      "modifyDate": "2019-08-24T14:15:22Z",
      "serviceArea": "global",
      "sourceDomainStatus": "string",
      "state": "创建中:CREATING, 创建成功:CREATED, 停用:DISABLE, 配置中:CONFIGURING, 异常:ABNORMAL, 删除中:DELETING"
    }
  ],
  "total": 0
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称                        | 类型                                                    | 必选    | 约束   | 中文名                 | 说明                                                             |
| ------------------------- | ----------------------------------------------------- | ----- | ---- | ------------------- | -------------------------------------------------------------- |
| » code                    | integer                                               | true  | none |                     | 200                                                            |
| » msg                     | string                                                | true  | none |                     | none                                                           |
| » data                    | [[DomainResult](#schemadomainresult)]                 | true  | none |                     | none                                                           |
| »» DomainResult           | [DomainResult](#schemadomainresult)                   | false | none | DomainResult        | none                                                           |
| »»» accountType           | string                                                | false | none |                     | none                                                           |
| »»» businessType          | string                                                | false | none |                     | 加速类型                                                           |
| »»» cname                 | string                                                | false | none |                     | 加速cname                                                        |
| »»» createDate            | string(date-time)                                     | false | none |                     | 创建时间                                                           |
| »»» disabled              | integer(int32)                                        | false | none |                     | 是否禁用                                                           |
| »»» domainConfig          | [DomainConfig](#schemadomainconfig)                   | false | none | DomainConfig        | none                                                           |
| »»»» cacheConfig          | [CacheConfig](#schemacacheconfig)                     | false | none | CacheConfig         | none                                                           |
| »»»»» compress            | integer(int32)                                        | false | none |                     | 是否开启压缩                                                         |
| »»»»» followOrigin        | boolean                                               | false | none |                     | 是否跟随源站                                                         |
| »»»»» ignoreUrlParameter  | boolean                                               | false | none |                     | 是否忽略url参数                                                      |
| »»»»» rules               | [[缓存规则](#schema%e7%bc%93%e5%ad%98%e8%a7%84%e5%88%99)] | false | none |                     | 缓存规则                                                           |
| »»»» certificateId        | string                                                | false | none |                     | none                                                           |
| »»»» forceRedirect        | [ForceRedirect](#schemaforceredirect)                 | false | none | ForceRedirect       | none                                                           |
| »»»»» status              | string                                                | false | none |                     | 开关状态                                                           |
| »»»»» type                | string                                                | false | none |                     | 重定向类型                                                          |
| »»»» httpResponseHeader   | [[HttpResponseHeader](#schemahttpresponseheader)]     | false | none |                     | 自定义响应头                                                         |
| »»»»» HttpResponseHeader  | [HttpResponseHeader](#schemahttpresponseheader)       | false | none | HttpResponseHeader  | none                                                           |
| »»»»»» action             | string                                                | false | none |                     | 操作类型                                                           |
| »»»»»» name               | string                                                | false | none |                     | 名称                                                             |
| »»»»»» value              | string                                                | false | none |                     | 值                                                              |
| »»»» https                | [HttpsInfo](#schemahttpsinfo)                         | false | none | HttpsInfo           | none                                                           |
| »»»»» certName            | string                                                | false | none |                     | 证书名称                                                           |
| »»»»» certificate         | string                                                | false | none |                     | 公钥                                                             |
| »»»»» expirationTime      | integer(int64)                                        | false | none |                     | 域名有效期                                                          |
| »»»»» httpsStatus         | string                                                | false | none |                     | 是否开启https                                                      |
| »»»»» privateKey          | string                                                | false | none |                     | 私钥                                                             |
| »»»» ipFilter             | [IpFilter](#schemaipfilter)                           | false | none | IpFilter            | none                                                           |
| »»»»» list                | [string]                                              | false | none |                     | ip列表                                                           |
| »»»»» type                | integer(int32)                                        | false | none |                     | IP黑白名单类型（0：关闭IP黑白名单功能，1：黑名单，2：白名单）                             |
| »»»» originProtocol       | string                                                | false | none |                     | 回原协议，取值：follow/http/https                                      |
| »»»» originRequestHeader  | [[OriginRequestHeader](#schemaoriginrequestheader)]   | false | none |                     | 回原请求头                                                          |
| »»»»» OriginRequestHeader | [OriginRequestHeader](#schemaoriginrequestheader)     | false | none | OriginRequestHeader | none                                                           |
| »»»»»» action             | string                                                | false | none |                     | 操作类型                                                           |
| »»»»»» name               | string                                                | false | none |                     | 名称                                                             |
| »»»»»» value              | string                                                | false | none |                     | 值                                                              |
| »»»» rangeStatus          | string                                                | false | none |                     | range 开关                                                       |
| »»»» referer              | [Referer](#schemareferer)                             | false | none | Referer             | none                                                           |
| »»»»» includeEmpty        | boolean                                               | false | none |                     | 是否支持空referer                                                   |
| »»»»» refererList         | string                                                | false | none |                     | 请输入域名或IP地址，以“;”进行分割，域名、IP地址可以混合输入，支持泛域名添加。输入的域名、IP地址总数不超过100个。 |
| »»»»» refererType         | integer(int32)                                        | false | none |                     | Referer类型。取值：0代表不设置Referer过滤；1代表黑名单；2代表白名单。默认取值为0              |
| »»»» sources              | [[ConfigSources](#schemaconfigsources)]               | false | none |                     | 回原配置                                                           |
| »»»»» ConfigSources       | [ConfigSources](#schemaconfigsources)                 | false | none | ConfigSources       | none                                                           |
| »»»»»» hostName           | string                                                | false | none |                     | 回原host                                                         |
| »»»»»» httpPort           | integer(int32)                                        | false | none |                     | http 端口                                                        |
| »»»»»» httpsPort          | integer(int32)                                        | false | none |                     | https 端口                                                       |
| »»»»»» ipOrDomain         | string                                                | false | none |                     | 回原ip或回原域名                                                      |
| »»»»»» originType         | string                                                | false | none |                     | 加速域名回原地址类型                                                     |
| »»»» urlAuth              | [UrlAuth](#schemaurlauth)                             | false | none | UrlAuth             | none                                                           |
| »»»»» backupKey           | string                                                | false | none |                     | 备用key，非必填                                                      |
| »»»»» expireTime          | integer(int32)                                        | false | none |                     | 有效期                                                            |
| »»»»» key                 | string                                                | false | none |                     | key                                                            |
| »»»»» signArg             | string                                                | false | none |                     | 鉴权参数：1-100位可以由大小写字母、数字、下划线构成（不能以数字开头）                          |
| »»»»» status              | string                                                | false | none |                     | 开关状态                                                           |
| »»»»» type                | string                                                | false | none |                     | none                                                           |
| »»» domainName            | string                                                | false | none |                     | 域名                                                             |
| »»» domainUserId          | string                                                | false | none |                     | none                                                           |
| »»» id                    | string                                                | false | none |                     | none                                                           |
| »»» locked                | integer(int32)                                        | false | none |                     | none                                                           |
| »»» modifyDate            | string(date-time)                                     | false | none |                     | 最后修改时间                                                         |
| »»» serviceArea           | string                                                | false | none |                     | none                                                           |
| »»» sourceDomainStatus    | string                                                | false | none |                     | none                                                           |
| »»» state                 | string                                                | false | none |                     | 域名状态                                                           |
| » total                   | integer                                               | true  | none |                     | 总数量                                                            |

#### 枚举值

| 属性           | 值                      |
| ------------ | ---------------------- |
| accountType  | ALIYUN                 |
| accountType  | HUAWEI                 |
| accountType  | TENCENT                |
| accountType  | VOLC                   |
| businessType | download               |
| businessType | video                  |
| businessType | web                    |
| status       | off                    |
| status       | on                     |
| httpsStatus  | off                    |
| httpsStatus  | on                     |
| rangeStatus  | off                    |
| rangeStatus  | on                     |
| originType   | domain                 |
| originType   | ipaddr                 |
| status       | off                    |
| status       | on                     |
| type         | type_a                 |
| type         | type_b                 |
| serviceArea  | global                 |
| serviceArea  | mainland_china         |
| serviceArea  | outside_mainland_china |
| state        | CREATED                |
| state        | CREATING               |
| state        | DELETE                 |
| state        | DISABLE                |

<a id="opIdgetCreateVerifyRecordUsingGET"></a>

## GET 查询域名归属验证

GET /api/v1.0/domain/query-create-verify-record

### 请求参数

| 名称         | 位置    | 类型     | 必选  | 中文名 | 说明  |
| ---------- | ----- | ------ | --- | --- | --- |
| domainName | query | string | 否   |     | 域名  |

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "data": {
    "checkId": "string",
    "fileVerifyName": "string",
    "fileVerifyUrl": "string",
    "record": "string",
    "recordType": "string",
    "subDomain": "string",
    "verified": true,
    "verifyDomain": "string"
  }
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称     | 类型                                                                                          | 必选   | 约束   | 中文名 | 说明   |
| ------ | ------------------------------------------------------------------------------------------- | ---- | ---- | --- | ---- |
| » code | integer                                                                                     | true | none |     | 200  |
| » msg  | string                                                                                      | true | none |     | none |
| » data | [线路创建域名验证](#schema%e7%ba%bf%e8%b7%af%e5%88%9b%e5%bb%ba%e5%9f%9f%e5%90%8d%e9%aa%8c%e8%af%81) | true | none |     | none |

<a id="opIdverifyRecordUsingPOST"></a>

## POST 验证域名归属

POST /api/v1.0/domain/verify-record

> Body 请求参数

```json
{
  "checkId": "string",
  "domainName": "string",
  "verifyType": "any"
}
```

### 请求参数

| 名称   | 位置   | 类型  | 必选  | 中文名 | 说明   |
| ---- | ---- | --- | --- | --- | ---- |
| body | body | any | 否   |     | none |

> 返回示例

> 200 Response

```json
{
  "msg": 0,
  "ms": "string",
  "data": {
    "checkId": "string",
    "domainName": "string",
    "verifyType": "any"
  }
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称     | 类型                                                                                          | 必选   | 约束   | 中文名 | 说明   |
| ------ | ------------------------------------------------------------------------------------------- | ---- | ---- | --- | ---- |
| » msg  | integer                                                                                     | true | none |     | 200  |
| » ms   | string                                                                                      | true | none |     | none |
| » data | [域名归属验证结构](#schema%e5%9f%9f%e5%90%8d%e5%bd%92%e5%b1%9e%e9%aa%8c%e8%af%81%e7%bb%93%e6%9e%84) | true | none |     | none |

<a id="opIdcacheRuleUsingPOST"></a>

## POST 缓存规则

POST /api/v1.0/domain/{domainId}/cache-rule

> Body 请求参数

```json
{
  "compress": 0,
  "followOrigin": true,
  "ignoreUrlParameter": true,
  "rules": [
    {
      "content": "string",
      "priority": 0,
      "ruleType": 0,
      "ttl": 0,
      "ttlType": 0
    }
  ]
}
```

### 请求参数

| 名称       | 位置   | 类型                                | 必选  | 中文名         | 说明       |
| -------- | ---- | --------------------------------- | --- | ----------- | -------- |
| domainId | path | string                            | 是   |             | domainId |
| body     | body | [CacheConfig](#schemacacheconfig) | 否   | CacheConfig | none     |

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "property1": {},
  "property2": {}
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称                         | 类型      | 必选    | 约束   | 中文名 | 说明   |
| -------------------------- | ------- | ----- | ---- | --- | ---- |
| » **additionalProperties** | object  | false | none |     | none |
| » code                     | integer | true  | none |     | 200  |
| » msg                      | string  | true  | none |     | none |

<a id="opIddetailUsingGET"></a>

## GET 域名详情

GET /api/v1.0/domain/{domainId}/detail

### 请求参数

| 名称       | 位置   | 类型     | 必选  | 中文名 | 说明   |
| -------- | ---- | ------ | --- | --- | ---- |
| domainId | path | string | 是   |     | 域名id |

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "data": {
    "accountType": "ALIYUN",
    "businessType": "网页:web/下载:download/视频:video",
    "cname": "string",
    "createDate": "2019-08-24T14:15:22Z",
    "disabled": 0,
    "domainConfig": {
      "cacheConfig": {
        "compress": 0,
        "followOrigin": true,
        "ignoreUrlParameter": true,
        "rules": [
          {
            "content": "string",
            "priority": 0,
            "ruleType": 0,
            "ttl": 0,
            "ttlType": 0
          }
        ]
      },
      "certificateId": "string",
      "forceRedirect": {
        "status": "on/off",
        "type": "http/https/"
      },
      "httpResponseHeader": [
        {
          "action": "[",
          "name": "string",
          "value": "string"
        }
      ],
      "https": {
        "certName": "string",
        "certificate": "string",
        "expirationTime": 0,
        "httpsStatus": "off",
        "privateKey": "string"
      },
      "ipFilter": {
        "list": [
          "string"
        ],
        "type": 0
      },
      "originProtocol": "string",
      "originRequestHeader": [
        {
          "action": "[",
          "name": "string",
          "value": "string"
        }
      ],
      "rangeStatus": "on/off",
      "referer": {
        "includeEmpty": true,
        "refererList": "string",
        "refererType": 0
      },
      "sources": [
        {
          "hostName": "string",
          "httpPort": "[",
          "httpsPort": "[",
          "ipOrDomain": "string",
          "originType": "["
        }
      ],
      "urlAuth": {
        "backupKey": "string",
        "expireTime": 0,
        "key": "string",
        "signArg": "string",
        "status": "on/off",
        "type": "type_a"
      }
    },
    "domainName": "string",
    "domainUserId": "string",
    "id": "string",
    "locked": 0,
    "modifyDate": "2019-08-24T14:15:22Z",
    "serviceArea": "global",
    "sourceDomainStatus": "string",
    "state": "创建中:CREATING, 创建成功:CREATED, 停用:DISABLE, 配置中:CONFIGURING, 异常:ABNORMAL, 删除中:DELETING"
  }
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称                       | 类型                                                    | 必选    | 约束   | 中文名                 | 说明                                                             |
| ------------------------ | ----------------------------------------------------- | ----- | ---- | ------------------- | -------------------------------------------------------------- |
| » code                   | integer                                               | true  | none |                     | 200                                                            |
| » msg                    | string                                                | true  | none |                     | none                                                           |
| » data                   | [DomainResult](#schemadomainresult)                   | true  | none | DomainResult        | none                                                           |
| »» accountType           | string                                                | false | none |                     | none                                                           |
| »» businessType          | string                                                | false | none |                     | 加速类型                                                           |
| »» cname                 | string                                                | false | none |                     | 加速cname                                                        |
| »» createDate            | string(date-time)                                     | false | none |                     | 创建时间                                                           |
| »» disabled              | integer(int32)                                        | false | none |                     | 是否禁用                                                           |
| »» domainConfig          | [DomainConfig](#schemadomainconfig)                   | false | none | DomainConfig        | none                                                           |
| »»» cacheConfig          | [CacheConfig](#schemacacheconfig)                     | false | none | CacheConfig         | none                                                           |
| »»»» compress            | integer(int32)                                        | false | none |                     | 是否开启压缩                                                         |
| »»»» followOrigin        | boolean                                               | false | none |                     | 是否跟随源站                                                         |
| »»»» ignoreUrlParameter  | boolean                                               | false | none |                     | 是否忽略url参数                                                      |
| »»»» rules               | [[缓存规则](#schema%e7%bc%93%e5%ad%98%e8%a7%84%e5%88%99)] | false | none |                     | 缓存规则                                                           |
| »»» certificateId        | string                                                | false | none |                     | none                                                           |
| »»» forceRedirect        | [ForceRedirect](#schemaforceredirect)                 | false | none | ForceRedirect       | none                                                           |
| »»»» status              | string                                                | false | none |                     | 开关状态                                                           |
| »»»» type                | string                                                | false | none |                     | 重定向类型                                                          |
| »»» httpResponseHeader   | [[HttpResponseHeader](#schemahttpresponseheader)]     | false | none |                     | 自定义响应头                                                         |
| »»»» HttpResponseHeader  | [HttpResponseHeader](#schemahttpresponseheader)       | false | none | HttpResponseHeader  | none                                                           |
| »»»»» action             | string                                                | false | none |                     | 操作类型                                                           |
| »»»»» name               | string                                                | false | none |                     | 名称                                                             |
| »»»»» value              | string                                                | false | none |                     | 值                                                              |
| »»» https                | [HttpsInfo](#schemahttpsinfo)                         | false | none | HttpsInfo           | none                                                           |
| »»»» certName            | string                                                | false | none |                     | 证书名称                                                           |
| »»»» certificate         | string                                                | false | none |                     | 公钥                                                             |
| »»»» expirationTime      | integer(int64)                                        | false | none |                     | 域名有效期                                                          |
| »»»» httpsStatus         | string                                                | false | none |                     | 是否开启https                                                      |
| »»»» privateKey          | string                                                | false | none |                     | 私钥                                                             |
| »»» ipFilter             | [IpFilter](#schemaipfilter)                           | false | none | IpFilter            | none                                                           |
| »»»» list                | [string]                                              | false | none |                     | ip列表                                                           |
| »»»» type                | integer(int32)                                        | false | none |                     | IP黑白名单类型（0：关闭IP黑白名单功能，1：黑名单，2：白名单）                             |
| »»» originProtocol       | string                                                | false | none |                     | 回原协议，取值：follow/http/https                                      |
| »»» originRequestHeader  | [[OriginRequestHeader](#schemaoriginrequestheader)]   | false | none |                     | 回原请求头                                                          |
| »»»» OriginRequestHeader | [OriginRequestHeader](#schemaoriginrequestheader)     | false | none | OriginRequestHeader | none                                                           |
| »»»»» action             | string                                                | false | none |                     | 操作类型                                                           |
| »»»»» name               | string                                                | false | none |                     | 名称                                                             |
| »»»»» value              | string                                                | false | none |                     | 值                                                              |
| »»» rangeStatus          | string                                                | false | none |                     | range 开关                                                       |
| »»» referer              | [Referer](#schemareferer)                             | false | none | Referer             | none                                                           |
| »»»» includeEmpty        | boolean                                               | false | none |                     | 是否支持空referer                                                   |
| »»»» refererList         | string                                                | false | none |                     | 请输入域名或IP地址，以“;”进行分割，域名、IP地址可以混合输入，支持泛域名添加。输入的域名、IP地址总数不超过100个。 |
| »»»» refererType         | integer(int32)                                        | false | none |                     | Referer类型。取值：0代表不设置Referer过滤；1代表黑名单；2代表白名单。默认取值为0              |
| »»» sources              | [[ConfigSources](#schemaconfigsources)]               | false | none |                     | 回原配置                                                           |
| »»»» ConfigSources       | [ConfigSources](#schemaconfigsources)                 | false | none | ConfigSources       | none                                                           |
| »»»»» hostName           | string                                                | false | none |                     | 回原host                                                         |
| »»»»» httpPort           | integer(int32)                                        | false | none |                     | http 端口                                                        |
| »»»»» httpsPort          | integer(int32)                                        | false | none |                     | https 端口                                                       |
| »»»»» ipOrDomain         | string                                                | false | none |                     | 回原ip或回原域名                                                      |
| »»»»» originType         | string                                                | false | none |                     | 加速域名回原地址类型                                                     |
| »»» urlAuth              | [UrlAuth](#schemaurlauth)                             | false | none | UrlAuth             | none                                                           |
| »»»» backupKey           | string                                                | false | none |                     | 备用key，非必填                                                      |
| »»»» expireTime          | integer(int32)                                        | false | none |                     | 有效期                                                            |
| »»»» key                 | string                                                | false | none |                     | key                                                            |
| »»»» signArg             | string                                                | false | none |                     | 鉴权参数：1-100位可以由大小写字母、数字、下划线构成（不能以数字开头）                          |
| »»»» status              | string                                                | false | none |                     | 开关状态                                                           |
| »»»» type                | string                                                | false | none |                     | none                                                           |
| »» domainName            | string                                                | false | none |                     | 域名                                                             |
| »» domainUserId          | string                                                | false | none |                     | none                                                           |
| »» id                    | string                                                | false | none |                     | none                                                           |
| »» locked                | integer(int32)                                        | false | none |                     | none                                                           |
| »» modifyDate            | string(date-time)                                     | false | none |                     | 最后修改时间                                                         |
| »» serviceArea           | string                                                | false | none |                     | none                                                           |
| »» sourceDomainStatus    | string                                                | false | none |                     | none                                                           |
| »» state                 | string                                                | false | none |                     | 域名状态                                                           |

#### 枚举值

| 属性           | 值                      |
| ------------ | ---------------------- |
| accountType  | ALIYUN                 |
| accountType  | HUAWEI                 |
| accountType  | TENCENT                |
| accountType  | VOLC                   |
| businessType | download               |
| businessType | video                  |
| businessType | web                    |
| status       | off                    |
| status       | on                     |
| httpsStatus  | off                    |
| httpsStatus  | on                     |
| rangeStatus  | off                    |
| rangeStatus  | on                     |
| originType   | domain                 |
| originType   | ipaddr                 |
| status       | off                    |
| status       | on                     |
| type         | type_a                 |
| type         | type_b                 |
| serviceArea  | global                 |
| serviceArea  | mainland_china         |
| serviceArea  | outside_mainland_china |
| state        | CREATED                |
| state        | CREATING               |
| state        | DELETE                 |
| state        | DISABLE                |

<a id="opIdupdateForceRedirectUsingPOST"></a>

## POST 强制重定向配置

POST /api/v1.0/domain/{domainId}/force-redirect

> Body 请求参数

```json
{
  "status": "on/off",
  "type": "http/https/"
}
```

### 请求参数

| 名称       | 位置   | 类型                                    | 必选  | 中文名           | 说明       |
| -------- | ---- | ------------------------------------- | --- | ------------- | -------- |
| domainId | path | string                                | 是   |               | domainId |
| body     | body | [ForceRedirect](#schemaforceredirect) | 否   | ForceRedirect | none     |

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "property1": {},
  "property2": {}
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称                         | 类型      | 必选    | 约束   | 中文名 | 说明   |
| -------------------------- | ------- | ----- | ---- | --- | ---- |
| » **additionalProperties** | object  | false | none |     | none |
| » code                     | integer | true  | none |     | none |
| » msg                      | string  | true  | none |     | none |

<a id="opIdupdateHttpsInfoUsingPOST"></a>

## POST https配置

POST /api/v1.0/domain/{domainId}/https-info

> Body 请求参数

```json
{
  "certName": "string",
  "certificate": "string",
  "expirationTime": 0,
  "httpsStatus": "off",
  "privateKey": "string"
}
```

### 请求参数

| 名称       | 位置   | 类型                            | 必选  | 中文名       | 说明       |
| -------- | ---- | ----------------------------- | --- | --------- | -------- |
| domainId | path | string                        | 是   |           | domainId |
| body     | body | [HttpsInfo](#schemahttpsinfo) | 否   | HttpsInfo | none     |

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "property1": {},
  "property2": {}
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称                         | 类型      | 必选    | 约束   | 中文名 | 说明   |
| -------------------------- | ------- | ----- | ---- | --- | ---- |
| » **additionalProperties** | object  | false | none |     | none |
| » code                     | integer | true  | none |     | 200  |
| » msg                      | string  | true  | none |     | none |

<a id="opIdipFilterUsingPOST"></a>

## POST ip黑白名单

POST /api/v1.0/domain/{domainId}/ip-acl

> Body 请求参数

```json
{
  "list": [
    "string"
  ],
  "type": 0
}
```

### 请求参数

| 名称       | 位置   | 类型                          | 必选  | 中文名      | 说明   |
| -------- | ---- | --------------------------- | --- | -------- | ---- |
| domainId | path | string                      | 是   |          | 域名id |
| body     | body | [IpFilter](#schemaipfilter) | 否   | IpFilter | none |

> 返回示例

> 200 Response

```json
{
  "code": "string",
  "msg": "string",
  "property1": {},
  "property2": {}
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称                         | 类型     | 必选    | 约束   | 中文名 | 说明   |
| -------------------------- | ------ | ----- | ---- | --- | ---- |
| » **additionalProperties** | object | false | none |     | none |
| » code                     | string | true  | none |     | none |
| » msg                      | string | true  | none |     | none |

<a id="opIdupdateOriginUsingPOST"></a>

## POST 修改源站配置

POST /api/v1.0/domain/{domainId}/origin

> Body 请求参数

```json
{
  "hostName": "string",
  "httpPort": 0,
  "httpsPort": 0,
  "ipOrDomain": "string",
  "originType": "domain"
}
```

### 请求参数

| 名称       | 位置   | 类型                                                  | 必选  | 中文名                  | 说明   |
| -------- | ---- | --------------------------------------------------- | --- | -------------------- | ---- |
| domainId | path | string                                              | 是   |                      | 域名id |
| body     | body | [ConfigSourcesCommand](#schemaconfigsourcescommand) | 否   | ConfigSourcesCommand | none |

> 返回示例

> 200 Response

```json
{
  "code": "string",
  "msg": "string",
  "property1": {},
  "property2": {}
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称                         | 类型     | 必选    | 约束   | 中文名 | 说明   |
| -------------------------- | ------ | ----- | ---- | --- | ---- |
| » **additionalProperties** | object | false | none |     | none |
| » code                     | string | true  | none |     | none |
| » msg                      | string | true  | none |     | none |

<a id="opIdupdateOriginProtocolUsingPOST"></a>

## POST 回源方式

POST /api/v1.0/domain/{domainId}/origin-protocol

> Body 请求参数

```json
"string"
```

### 请求参数

| 名称       | 位置   | 类型     | 必选  | 中文名 | 说明   |
| -------- | ---- | ------ | --- | --- | ---- |
| domainId | path | string | 是   |     | 域名id |
| body     | body | string | 否   |     | none |

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "property1": {},
  "property2": {}
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称                         | 类型      | 必选    | 约束   | 中文名 | 说明   |
| -------------------------- | ------- | ----- | ---- | --- | ---- |
| » **additionalProperties** | object  | false | none |     | none |
| » code                     | integer | true  | none |     | 200  |
| » msg                      | string  | true  | none |     | none |

<a id="opIdupdateOriginUsingPOST_1"></a>

## POST Range回源

POST /api/v1.0/domain/{domainId}/range-switch

> Body 请求参数

```json
{
  "rangeSwitch": "off"
}
```

### 请求参数

| 名称       | 位置   | 类型                                              | 必选  | 中文名                | 说明   |
| -------- | ---- | ----------------------------------------------- | --- | ------------------ | ---- |
| domainId | path | string                                          | 是   |                    | 域名id |
| body     | body | [RangeSwitchCommand](#schemarangeswitchcommand) | 否   | RangeSwitchCommand | none |

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "property1": {},
  "property2": {}
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称                         | 类型      | 必选    | 约束   | 中文名 | 说明   |
| -------------------------- | ------- | ----- | ---- | --- | ---- |
| » **additionalProperties** | object  | false | none |     | none |
| » code                     | integer | true  | none |     | none |
| » msg                      | string  | true  | none |     | none |

<a id="opIdupdateRefererUsingPOST"></a>

## POST 设置Referer过滤规则

POST /api/v1.0/domain/{domainId}/referer

> Body 请求参数

```json
{
  "includeEmpty": true,
  "refererList": "string",
  "refererType": 0
}
```

### 请求参数

| 名称       | 位置   | 类型                        | 必选  | 中文名     | 说明   |
| -------- | ---- | ------------------------- | --- | ------- | ---- |
| domainId | path | string                    | 是   |         | 域名id |
| body     | body | [Referer](#schemareferer) | 否   | Referer | none |

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "property1": {},
  "property2": {}
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称                         | 类型      | 必选    | 约束   | 中文名 | 说明   |
| -------------------------- | ------- | ----- | ---- | --- | ---- |
| » **additionalProperties** | object  | false | none |     | none |
| » code                     | integer | true  | none |     | 200  |
| » msg                      | string  | true  | none |     | none |

<a id="opIdupdateOriginRequestHeaderUsingPOST"></a>

## POST 新增/修改回源请求头配置

POST /api/v1.0/domain/{domainId}/request-header

> Body 请求参数

```json
[
  {
    "action": "delete/set",
    "name": "string",
    "value": "string"
  }
]
```

### 请求参数

| 名称       | 位置   | 类型                                                          | 必选  | 中文名 | 说明   |
| -------- | ---- | ----------------------------------------------------------- | --- | --- | ---- |
| domainId | path | string                                                      | 是   |     | 域名id |
| body     | body | [OriginRequestHeaderArray](#schemaoriginrequestheaderarray) | 否   |     | none |

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "property1": {},
  "property2": {}
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称                         | 类型      | 必选    | 约束   | 中文名 | 说明   |
| -------------------------- | ------- | ----- | ---- | --- | ---- |
| » **additionalProperties** | object  | false | none |     | none |
| » code                     | integer | true  | none |     | none |
| » msg                      | string  | true  | none |     | none |

<a id="opIdupdateResponseHeaderUsingPOST"></a>

## POST 新增/修改域名响应头配置

POST /api/v1.0/domain/{domainId}/response-header

> Body 请求参数

```json
[
  {
    "action": "delete/set",
    "name": "string",
    "value": "string"
  }
]
```

### 请求参数

| 名称       | 位置   | 类型                                                        | 必选  | 中文名 | 说明   |
| -------- | ---- | --------------------------------------------------------- | --- | --- | ---- |
| domainId | path | string                                                    | 是   |     | 域名id |
| body     | body | [HttpResponseHeaderArray](#schemahttpresponseheaderarray) | 否   |     | none |

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "property1": {},
  "property2": {}
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称                         | 类型      | 必选    | 约束   | 中文名 | 说明   |
| -------------------------- | ------- | ----- | ---- | --- | ---- |
| » **additionalProperties** | object  | false | none |     | none |
| » code                     | integer | true  | none |     | none |
| » msg                      | string  | true  | none |     | none |

<a id="opIdupdateUrlAuthUsingPOST"></a>

## POST url 鉴权

POST /api/v1.0/domain/{domainId}/url-auth

> Body 请求参数

```json
{
  "backupKey": "string",
  "expireTime": 0,
  "key": "string",
  "signArg": "string",
  "status": "on/off",
  "type": "type_a"
}
```

### 请求参数

| 名称       | 位置   | 类型                        | 必选  | 中文名     | 说明   |
| -------- | ---- | ------------------------- | --- | ------- | ---- |
| domainId | path | string                    | 是   |         | 域名id |
| body     | body | [UrlAuth](#schemaurlauth) | 否   | UrlAuth | none |

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "msg": "string",
  "property1": {},
  "property2": {}
}
```

### 返回结果

| 状态码 | 状态码含义                                                   | 说明  | 数据模型   |
| --- | ------------------------------------------------------- | --- | ------ |
| 200 | [OK](https://tools.ietf.org/html/rfc7231#section-6.3.1) | OK  | Inline |

### 返回数据结构

状态码 **200**

| 名称                         | 类型      | 必选    | 约束   | 中文名 | 说明   |
| -------------------------- | ------- | ----- | ---- | --- | ---- |
| » **additionalProperties** | object  | false | none |     | none |
| » code                     | integer | true  | none |     | 200  |
| » msg                      | string  | true  | none |     | none |

# 数据模型

<h2 id="tocS_deleteUsingPOST_4Domainids">deleteUsingPOST_4Domainids</h2>

<a id="schemadeleteusingpost_4domainids"></a>
<a id="schema_deleteUsingPOST_4Domainids"></a>
<a id="tocSdeleteusingpost_4domainids"></a>
<a id="tocsdeleteusingpost_4domainids"></a>

```json
[
  "string"
]
```

### 属性

*None*

<h2 id="tocS_checkDomainFileUsingPOSTHosts">checkDomainFileUsingPOSTHosts</h2>

<a id="schemacheckdomainfileusingposthosts"></a>
<a id="schema_checkDomainFileUsingPOSTHosts"></a>
<a id="tocScheckdomainfileusingposthosts"></a>
<a id="tocscheckdomainfileusingposthosts"></a>

```json
"string"
```

### 属性

| 名称          | 类型     | 必选    | 约束   | 中文名 | 说明   |
| ----------- | ------ | ----- | ---- | --- | ---- |
| *anonymous* | string | false | none |     | none |

<h2 id="tocS_OriginRequestHeaderArray">OriginRequestHeaderArray</h2>

<a id="schemaoriginrequestheaderarray"></a>
<a id="schema_OriginRequestHeaderArray"></a>
<a id="tocSoriginrequestheaderarray"></a>
<a id="tocsoriginrequestheaderarray"></a>

```json
[
  {
    "action": "delete/set",
    "name": "string",
    "value": "string"
  }
]
```

### 属性

| 名称          | 类型                                                  | 必选    | 约束   | 中文名 | 说明   |
| ----------- | --------------------------------------------------- | ----- | ---- | --- | ---- |
| *anonymous* | [[OriginRequestHeader](#schemaoriginrequestheader)] | false | none |     | none |

<h2 id="tocS_HttpResponseHeaderArray">HttpResponseHeaderArray</h2>

<a id="schemahttpresponseheaderarray"></a>
<a id="schema_HttpResponseHeaderArray"></a>
<a id="tocShttpresponseheaderarray"></a>
<a id="tocshttpresponseheaderarray"></a>

```json
[
  {
    "action": "delete/set",
    "name": "string",
    "value": "string"
  }
]
```

### 属性

| 名称          | 类型                                                | 必选    | 约束   | 中文名 | 说明   |
| ----------- | ------------------------------------------------- | ----- | ---- | --- | ---- |
| *anonymous* | [[HttpResponseHeader](#schemahttpresponseheader)] | false | none |     | none |

<h2 id="tocS_缓存规则">缓存规则</h2>

<a id="schema缓存规则"></a>
<a id="schema_缓存规则"></a>
<a id="tocS缓存规则"></a>
<a id="tocs缓存规则"></a>

```json
{
  "content": "string",
  "priority": 0,
  "ruleType": 0,
  "ttl": 0,
  "ttlType": 0
}
```

缓存规则

### 属性

| 名称       | 类型             | 必选    | 约束   | 中文名 | 说明                                                                                                                                                                                                                                                                                             |
| -------- | -------------- | ----- | ---- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| content  | string         | false | none |     | 缓存匹配设置。 当rule_type为0时，为空。 当rule_type为1时，为文件后缀，输入首字符为“.”，以“;”进行分隔，如.jpg;.zip;.exe，并且输入的文件名后缀总数不超过20个。 当rule_type为2时，为目录，输入要求以“/”作为首字符，以“;”进行分隔，如/test/folder01;/test/folder02，并且输入的目录路径总数不超过20个。 当rule_type为3时，为全路径，输入要求以“/”作为首字符，支持匹配指定目录下的具体文件，或者带通配符“\\*”的文件，如/test/index.html或/test/\\*.jpg |
| priority | integer(int32) | false | none |     | 此条配置的权重值, 默认值1，数值越大，优先级越高。取值范围为1-100，权重值不能相同。                                                                                                                                                                                                                                                  |
| ruleType | integer(int32) | false | none |     | 0：全部类型，表示匹配所有文件，默认值。1：文件类型，表示按文件后缀匹配。2：文件夹类型，表示按目录匹配。  3：文件全路径类型，表示按文件全路径匹配。                                                                                                                                                                                                                   |
| ttl      | integer(int32) | false | none |     | ttl                                                                                                                                                                                                                                                                                            |
| ttlType  | integer(int32) | false | none |     | 1:秒,2:分钟,3:小时,4:天                                                                                                                                                                                                                                                                              |

<h2 id="tocS_线路创建域名验证">线路创建域名验证</h2>

<a id="schema线路创建域名验证"></a>
<a id="schema_线路创建域名验证"></a>
<a id="tocS线路创建域名验证"></a>
<a id="tocs线路创建域名验证"></a>

```json
{
  "checkId": "string",
  "fileVerifyName": "string",
  "fileVerifyUrl": "string",
  "record": "string",
  "recordType": "string",
  "subDomain": "string",
  "verified": true,
  "verifyDomain": "string"
}
```

线路创建域名验证

### 属性

| 名称             | 类型      | 必选    | 约束   | 中文名 | 说明      |
| -------------- | ------- | ----- | ---- | --- | ------- |
| checkId        | string  | false | none |     | none    |
| fileVerifyName | string  | false | none |     | 文件校验文件名 |
| fileVerifyUrl  | string  | false | none |     | 文件验证URL |
| record         | string  | false | none |     | 解析值     |
| recordType     | string  | false | none |     | 解析类型    |
| subDomain      | string  | false | none |     | 子解析     |
| verified       | boolean | false | none |     | 是否需要校验  |
| verifyDomain   | string  | false | none |     | 文件校验域名  |

<h2 id="tocS_域名状态码统计">域名状态码统计</h2>

<a id="schema域名状态码统计"></a>
<a id="schema_域名状态码统计"></a>
<a id="tocS域名状态码统计"></a>
<a id="tocs域名状态码统计"></a>

```json
{
  "bsHttpCode2xx": [
    0
  ],
  "bsHttpCode2xxCount": 0,
  "bsHttpCode3xx": [
    0
  ],
  "bsHttpCode3xxCount": 0,
  "bsHttpCode4xx": [
    0
  ],
  "bsHttpCode4xxCount": 0,
  "bsHttpCode5xx": [
    0
  ],
  "bsHttpCode5xxCount": 0,
  "endTime": 0,
  "httpCode2xx": [
    0
  ],
  "httpCode2xxCount": 0,
  "httpCode3xx": [
    0
  ],
  "httpCode3xxCount": 0,
  "httpCode4xx": [
    0
  ],
  "httpCode4xxCount": 0,
  "httpCode5xx": [
    0
  ],
  "httpCode5xxCount": 0,
  "interval": 0,
  "startTime": 0
}
```

域名状态码统计

### 属性

| 名称                 | 类型             | 必选    | 约束   | 中文名 | 说明              |
| ------------------ | -------------- | ----- | ---- | --- | --------------- |
| bsHttpCode2xx      | [integer]      | false | none |     | 回原 http 2xx 状态码 |
| bsHttpCode2xxCount | integer(int64) | false | none |     | none            |
| bsHttpCode3xx      | [integer]      | false | none |     | none            |
| bsHttpCode3xxCount | integer(int64) | false | none |     | none            |
| bsHttpCode4xx      | [integer]      | false | none |     | none            |
| bsHttpCode4xxCount | integer(int64) | false | none |     | none            |
| bsHttpCode5xx      | [integer]      | false | none |     | none            |
| bsHttpCode5xxCount | integer(int64) | false | none |     | none            |
| endTime            | integer(int64) | false | none |     | none            |
| httpCode2xx        | [integer]      | false | none |     | http 2xx 状态码    |
| httpCode2xxCount   | integer(int64) | false | none |     | none            |
| httpCode3xx        | [integer]      | false | none |     | none            |
| httpCode3xxCount   | integer(int64) | false | none |     | none            |
| httpCode4xx        | [integer]      | false | none |     | none            |
| httpCode4xxCount   | integer(int64) | false | none |     | none            |
| httpCode5xx        | [integer]      | false | none |     | none            |
| httpCode5xxCount   | integer(int64) | false | none |     | none            |
| interval           | integer(int64) | false | none |     | none            |
| startTime          | integer(int64) | false | none |     | none            |

<h2 id="tocS_域名归属验证结构">域名归属验证结构</h2>

<a id="schema域名归属验证结构"></a>
<a id="schema_域名归属验证结构"></a>
<a id="tocS域名归属验证结构"></a>
<a id="tocs域名归属验证结构"></a>

```json
{
  "checkId": "string",
  "domainName": "string",
  "verifyType": "any"
}
```

域名归属验证结构

### 属性

| 名称         | 类型     | 必选    | 约束   | 中文名 | 说明      |
| ---------- | ------ | ----- | ---- | --- | ------- |
| checkId    | string | false | none |     | checkId |
| domainName | string | false | none |     | 待验证域名   |
| verifyType | string | false | none |     | 验证类型    |

#### 枚举值

| 属性         | 值    |
| ---------- | ---- |
| verifyType | any  |
| verifyType | dns  |
| verifyType | file |

<h2 id="tocS_UrlAuth">UrlAuth</h2>

<a id="schemaurlauth"></a>
<a id="schema_UrlAuth"></a>
<a id="tocSurlauth"></a>
<a id="tocsurlauth"></a>

```json
{
  "backupKey": "string",
  "expireTime": 0,
  "key": "string",
  "signArg": "string",
  "status": "on/off",
  "type": "type_a"
}
```

UrlAuth

### 属性

| 名称         | 类型             | 必选    | 约束   | 中文名 | 说明                                    |
| ---------- | -------------- | ----- | ---- | --- | ------------------------------------- |
| backupKey  | string         | false | none |     | 备用key，非必填                             |
| expireTime | integer(int32) | false | none |     | 有效期                                   |
| key        | string         | false | none |     | key                                   |
| signArg    | string         | false | none |     | 鉴权参数：1-100位可以由大小写字母、数字、下划线构成（不能以数字开头） |
| status     | string         | false | none |     | 开关状态                                  |
| type       | string         | false | none |     | none                                  |

#### 枚举值

| 属性     | 值      |
| ------ | ------ |
| status | off    |
| status | on     |
| type   | type_a |
| type   | type_b |

<h2 id="tocS_TaskInfo">TaskInfo</h2>

<a id="schemataskinfo"></a>
<a id="schema_TaskInfo"></a>
<a id="tocStaskinfo"></a>
<a id="tocstaskinfo"></a>

```json
{
  "state": "FAIL",
  "url": "string"
}
```

TaskInfo

### 属性

| 名称    | 类型     | 必选    | 约束   | 中文名 | 说明   |
| ----- | ------ | ----- | ---- | --- | ---- |
| state | string | false | none |     | 任务状态 |
| url   | string | false | none |     | none |

#### 枚举值

| 属性    | 值          |
| ----- | ---------- |
| state | FAIL       |
| state | PROCESSING |
| state | SUCCESS    |

<h2 id="tocS_Task">Task</h2>

<a id="schematask"></a>
<a id="schema_Task"></a>
<a id="tocStask"></a>
<a id="tocstask"></a>

```json
{
  "type": "file 或directory,默认为file",
  "urls": [
    "string"
  ]
}
```

Task

### 属性

| 名称   | 类型       | 必选    | 约束   | 中文名 | 说明       |
| ---- | -------- | ----- | ---- | --- | -------- |
| type | string   | false | none |     | 预热刷新路径类型 |
| urls | [string] | false | none |     | 预热刷新的路径  |

<h2 id="tocS_Referer">Referer</h2>

<a id="schemareferer"></a>
<a id="schema_Referer"></a>
<a id="tocSreferer"></a>
<a id="tocsreferer"></a>

```json
{
  "includeEmpty": true,
  "refererList": "string",
  "refererType": 0
}
```

Referer

### 属性

| 名称           | 类型             | 必选    | 约束   | 中文名 | 说明                                                             |
| ------------ | -------------- | ----- | ---- | --- | -------------------------------------------------------------- |
| includeEmpty | boolean        | false | none |     | 是否支持空referer                                                   |
| refererList  | string         | false | none |     | 请输入域名或IP地址，以“;”进行分割，域名、IP地址可以混合输入，支持泛域名添加。输入的域名、IP地址总数不超过100个。 |
| refererType  | integer(int32) | false | none |     | Referer类型。取值：0代表不设置Referer过滤；1代表黑名单；2代表白名单。默认取值为0              |

<h2 id="tocS_RangeSwitchCommand">RangeSwitchCommand</h2>

<a id="schemarangeswitchcommand"></a>
<a id="schema_RangeSwitchCommand"></a>
<a id="tocSrangeswitchcommand"></a>
<a id="tocsrangeswitchcommand"></a>

```json
{
  "rangeSwitch": "off"
}
```

RangeSwitchCommand

### 属性

| 名称          | 类型     | 必选   | 约束   | 中文名 | 说明   |
| ----------- | ------ | ---- | ---- | --- | ---- |
| rangeSwitch | string | true | none |     | none |

#### 枚举值

| 属性          | 值   |
| ----------- | --- |
| rangeSwitch | off |
| rangeSwitch | on  |

<h2 id="tocS_PreheatingOrRefreshResult">PreheatingOrRefreshResult</h2>

<a id="schemapreheatingorrefreshresult"></a>
<a id="schema_PreheatingOrRefreshResult"></a>
<a id="tocSpreheatingorrefreshresult"></a>
<a id="tocspreheatingorrefreshresult"></a>

```json
{
  "createDate": "2019-08-24T14:15:22Z",
  "id": "string",
  "modifyDate": "2019-08-24T14:15:22Z",
  "state": "FAIL",
  "task": {
    "type": "file 或directory,默认为file",
    "urls": [
      "string"
    ]
  },
  "taskInfos": [
    {
      "state": "FAIL",
      "url": "string"
    }
  ],
  "type": "PREHEATING"
}
```

PreheatingOrRefreshResult

### 属性

| 名称         | 类型                            | 必选    | 约束   | 中文名 | 说明     |
| ---------- | ----------------------------- | ----- | ---- | --- | ------ |
| createDate | string(date-time)             | false | none |     | 任务执行时间 |
| id         | string                        | false | none |     | none   |
| modifyDate | string(date-time)             | false | none |     | none   |
| state      | string                        | false | none |     | 任务执行状态 |
| task       | [Task](#schematask)           | false | none |     | none   |
| taskInfos  | [[TaskInfo](#schemataskinfo)] | false | none |     | 任务执行详情 |
| type       | string                        | false | none |     | 任务类型   |

#### 枚举值

| 属性    | 值          |
| ----- | ---------- |
| state | FAIL       |
| state | PROCESSING |
| state | SUCCESS    |
| type  | PREHEATING |
| type  | REFRESH    |

<h2 id="tocS_OriginRequestHeader">OriginRequestHeader</h2>

<a id="schemaoriginrequestheader"></a>
<a id="schema_OriginRequestHeader"></a>
<a id="tocSoriginrequestheader"></a>
<a id="tocsoriginrequestheader"></a>

```json
{
  "action": "delete/set",
  "name": "string",
  "value": "string"
}
```

OriginRequestHeader

### 属性

| 名称     | 类型     | 必选    | 约束   | 中文名 | 说明   |
| ------ | ------ | ----- | ---- | --- | ---- |
| action | string | false | none |     | 操作类型 |
| name   | string | false | none |     | 名称   |
| value  | string | false | none |     | 值    |

<h2 id="tocS_MyStatisticsDomainResult">MyStatisticsDomainResult</h2>

<a id="schemamystatisticsdomainresult"></a>
<a id="schema_MyStatisticsDomainResult"></a>
<a id="tocSmystatisticsdomainresult"></a>
<a id="tocsmystatisticsdomainresult"></a>

```json
{
  "deleted": true,
  "domainName": "string"
}
```

MyStatisticsDomainResult

### 属性

| 名称         | 类型      | 必选    | 约束   | 中文名 | 说明   |
| ---------- | ------- | ----- | ---- | --- | ---- |
| deleted    | boolean | false | none |     | none |
| domainName | string  | false | none |     | none |

<h2 id="tocS_IpFilter">IpFilter</h2>

<a id="schemaipfilter"></a>
<a id="schema_IpFilter"></a>
<a id="tocSipfilter"></a>
<a id="tocsipfilter"></a>

```json
{
  "list": [
    "string"
  ],
  "type": 0
}
```

IpFilter

### 属性

| 名称   | 类型             | 必选    | 约束   | 中文名 | 说明                                 |
| ---- | -------------- | ----- | ---- | --- | ---------------------------------- |
| list | [string]       | false | none |     | ip列表                               |
| type | integer(int32) | false | none |     | IP黑白名单类型（0：关闭IP黑白名单功能，1：黑名单，2：白名单） |

<h2 id="tocS_HttpsInfo">HttpsInfo</h2>

<a id="schemahttpsinfo"></a>
<a id="schema_HttpsInfo"></a>
<a id="tocShttpsinfo"></a>
<a id="tocshttpsinfo"></a>

```json
{
  "certName": "string",
  "certificate": "string",
  "expirationTime": 0,
  "httpsStatus": "off",
  "privateKey": "string"
}
```

HttpsInfo

### 属性

| 名称             | 类型             | 必选    | 约束   | 中文名 | 说明        |
| -------------- | -------------- | ----- | ---- | --- | --------- |
| certName       | string         | false | none |     | 证书名称      |
| certificate    | string         | false | none |     | 公钥        |
| expirationTime | integer(int64) | false | none |     | 域名有效期     |
| httpsStatus    | string         | false | none |     | 是否开启https |
| privateKey     | string         | false | none |     | 私钥        |

#### 枚举值

| 属性          | 值   |
| ----------- | --- |
| httpsStatus | off |
| httpsStatus | on  |

<h2 id="tocS_HttpResponseHeader">HttpResponseHeader</h2>

<a id="schemahttpresponseheader"></a>
<a id="schema_HttpResponseHeader"></a>
<a id="tocShttpresponseheader"></a>
<a id="tocshttpresponseheader"></a>

```json
{
  "action": "delete/set",
  "name": "string",
  "value": "string"
}
```

HttpResponseHeader

### 属性

| 名称     | 类型     | 必选    | 约束   | 中文名 | 说明   |
| ------ | ------ | ----- | ---- | --- | ---- |
| action | string | false | none |     | 操作类型 |
| name   | string | false | none |     | 名称   |
| value  | string | false | none |     | 值    |

<h2 id="tocS_ForceRedirect">ForceRedirect</h2>

<a id="schemaforceredirect"></a>
<a id="schema_ForceRedirect"></a>
<a id="tocSforceredirect"></a>
<a id="tocsforceredirect"></a>

```json
{
  "status": "on/off",
  "type": "http/https/"
}
```

ForceRedirect

### 属性

| 名称     | 类型     | 必选    | 约束   | 中文名 | 说明    |
| ------ | ------ | ----- | ---- | --- | ----- |
| status | string | false | none |     | 开关状态  |
| type   | string | false | none |     | 重定向类型 |

#### 枚举值

| 属性     | 值   |
| ------ | --- |
| status | off |
| status | on  |

<h2 id="tocS_DomainStatisticsResult">DomainStatisticsResult</h2>

<a id="schemadomainstatisticsresult"></a>
<a id="schema_DomainStatisticsResult"></a>
<a id="tocSdomainstatisticsresult"></a>
<a id="tocsdomainstatisticsresult"></a>

```json
{
  "maxBw": 0,
  "totalFlux": 0,
  "bw": [
    0
  ],
  "endTime": 0,
  "flux": [
    0
  ],
  "interval": 0,
  "startTime": 0
}
```

DomainStatisticsResult

### 属性

| 名称        | 类型             | 必选    | 约束   | 中文名 | 说明   |
| --------- | -------------- | ----- | ---- | --- | ---- |
| bw        | [integer]      | false | none |     | 带宽   |
| endTime   | integer(int64) | false | none |     | none |
| maxBw     | integer(int64) | false | none |     | 最大带宽 |
| totalFlux | integer(int64) | false | none |     | 总流量  |
| flux      | [integer]      | false | none |     | 流量   |
| interval  | integer(int64) | false | none |     | none |
| startTime | integer(int64) | false | none |     | none |

<h2 id="tocS_DomainResult">DomainResult</h2>

<a id="schemadomainresult"></a>
<a id="schema_DomainResult"></a>
<a id="tocSdomainresult"></a>
<a id="tocsdomainresult"></a>

```json
{
  "accountType": "ALIYUN",
  "businessType": "网页:web/下载:download/视频:video",
  "cname": "string",
  "createDate": "2019-08-24T14:15:22Z",
  "disabled": 0,
  "domainConfig": {
    "cacheConfig": {
      "compress": 0,
      "followOrigin": true,
      "ignoreUrlParameter": true,
      "rules": [
        {
          "content": "string",
          "priority": 0,
          "ruleType": 0,
          "ttl": 0,
          "ttlType": 0
        }
      ]
    },
    "certificateId": "string",
    "forceRedirect": {
      "status": "on/off",
      "type": "http/https/"
    },
    "httpResponseHeader": [
      {
        "action": "delete/set",
        "name": "string",
        "value": "string"
      }
    ],
    "https": {
      "certName": "string",
      "certificate": "string",
      "expirationTime": 0,
      "httpsStatus": "off",
      "privateKey": "string"
    },
    "ipFilter": {
      "list": [
        "string"
      ],
      "type": 0
    },
    "originProtocol": "string",
    "originRequestHeader": [
      {
        "action": "delete/set",
        "name": "string",
        "value": "string"
      }
    ],
    "rangeStatus": "on/off",
    "referer": {
      "includeEmpty": true,
      "refererList": "string",
      "refererType": 0
    },
    "sources": [
      {
        "hostName": "string",
        "httpPort": 80,
        "httpsPort": 443,
        "ipOrDomain": "string",
        "originType": "ipaddr/domain"
      }
    ],
    "urlAuth": {
      "backupKey": "string",
      "expireTime": 0,
      "key": "string",
      "signArg": "string",
      "status": "on/off",
      "type": "type_a"
    }
  },
  "domainName": "string",
  "domainUserId": "string",
  "id": "string",
  "locked": 0,
  "modifyDate": "2019-08-24T14:15:22Z",
  "serviceArea": "global",
  "sourceDomainStatus": "string",
  "state": "创建中:CREATING, 创建成功:CREATED, 停用:DISABLE, 配置中:CONFIGURING, 异常:ABNORMAL, 删除中:DELETING"
}
```

DomainResult

### 属性

| 名称                 | 类型                                  | 必选    | 约束   | 中文名 | 说明      |
| ------------------ | ----------------------------------- | ----- | ---- | --- | ------- |
| accountType        | string                              | false | none |     | none    |
| businessType       | string                              | false | none |     | 加速类型    |
| cname              | string                              | false | none |     | 加速cname |
| createDate         | string(date-time)                   | false | none |     | 创建时间    |
| disabled           | integer(int32)                      | false | none |     | 是否禁用    |
| domainConfig       | [DomainConfig](#schemadomainconfig) | false | none |     | none    |
| domainName         | string                              | false | none |     | 域名      |
| domainUserId       | string                              | false | none |     | none    |
| id                 | string                              | false | none |     | none    |
| locked             | integer(int32)                      | false | none |     | none    |
| modifyDate         | string(date-time)                   | false | none |     | 最后修改时间  |
| serviceArea        | string                              | false | none |     | none    |
| sourceDomainStatus | string                              | false | none |     | none    |
| state              | string                              | false | none |     | 域名状态    |

#### 枚举值

| 属性           | 值                      |
| ------------ | ---------------------- |
| accountType  | ALIYUN                 |
| accountType  | HUAWEI                 |
| accountType  | TENCENT                |
| accountType  | VOLC                   |
| businessType | download               |
| businessType | video                  |
| businessType | web                    |
| serviceArea  | global                 |
| serviceArea  | mainland_china         |
| serviceArea  | outside_mainland_china |
| state        | CREATED                |
| state        | CREATING               |
| state        | DELETE                 |
| state        | DISABLE                |

<h2 id="tocS_DomainHitRateStatisticsResult">DomainHitRateStatisticsResult</h2>

<a id="schemadomainhitratestatisticsresult"></a>
<a id="schema_DomainHitRateStatisticsResult"></a>
<a id="tocSdomainhitratestatisticsresult"></a>
<a id="tocsdomainhitratestatisticsresult"></a>

```json
{
  "endTime": 0,
  "hitRate": [
    0
  ],
  "interval": 0,
  "startTime": 0
}
```

DomainHitRateStatisticsResult

### 属性

| 名称        | 类型             | 必选    | 约束   | 中文名 | 说明   |
| --------- | -------------- | ----- | ---- | --- | ---- |
| endTime   | integer(int64) | false | none |     | none |
| hitRate   | [number]       | false | none |     | none |
| interval  | integer(int64) | false | none |     | none |
| startTime | integer(int64) | false | none |     | none |

<h2 id="tocS_DomainCreateCommand">DomainCreateCommand</h2>

<a id="schemadomaincreatecommand"></a>
<a id="schema_DomainCreateCommand"></a>
<a id="tocSdomaincreatecommand"></a>
<a id="tocsdomaincreatecommand"></a>

```json
{
  "businessType": "网页:web/下载:download/视频:video",
  "domainName": "string",
  "sources": [
    {
      "hostName": "string",
      "httpPort": 80,
      "httpsPort": 443,
      "ipOrDomain": "string",
      "originType": "ipaddr/domain"
    }
  ]
}
```

DomainCreateCommand

### 属性

| 名称           | 类型                                      | 必选    | 约束   | 中文名 | 说明   |
| ------------ | --------------------------------------- | ----- | ---- | --- | ---- |
| businessType | string                                  | false | none |     | 加速类型 |
| domainName   | string                                  | false | none |     | 域名   |
| sources      | [[ConfigSources](#schemaconfigsources)] | false | none |     | 源站配置 |

#### 枚举值

| 属性           | 值        |
| ------------ | -------- |
| businessType | download |
| businessType | video    |
| businessType | web      |

<h2 id="tocS_DomainConfig">DomainConfig</h2>

<a id="schemadomainconfig"></a>
<a id="schema_DomainConfig"></a>
<a id="tocSdomainconfig"></a>
<a id="tocsdomainconfig"></a>

```json
{
  "cacheConfig": {
    "compress": 0,
    "followOrigin": true,
    "ignoreUrlParameter": true,
    "rules": [
      {
        "content": "string",
        "priority": 0,
        "ruleType": 0,
        "ttl": 0,
        "ttlType": 0
      }
    ]
  },
  "certificateId": "string",
  "forceRedirect": {
    "status": "on/off",
    "type": "http/https/"
  },
  "httpResponseHeader": [
    {
      "action": "delete/set",
      "name": "string",
      "value": "string"
    }
  ],
  "https": {
    "certName": "string",
    "certificate": "string",
    "expirationTime": 0,
    "httpsStatus": "off",
    "privateKey": "string"
  },
  "ipFilter": {
    "list": [
      "string"
    ],
    "type": 0
  },
  "originProtocol": "string",
  "originRequestHeader": [
    {
      "action": "delete/set",
      "name": "string",
      "value": "string"
    }
  ],
  "rangeStatus": "on/off",
  "referer": {
    "includeEmpty": true,
    "refererList": "string",
    "refererType": 0
  },
  "sources": [
    {
      "hostName": "string",
      "httpPort": 80,
      "httpsPort": 443,
      "ipOrDomain": "string",
      "originType": "ipaddr/domain"
    }
  ],
  "urlAuth": {
    "backupKey": "string",
    "expireTime": 0,
    "key": "string",
    "signArg": "string",
    "status": "on/off",
    "type": "type_a"
  }
}
```

DomainConfig

### 属性

| 名称                  | 类型                                                  | 必选    | 约束   | 中文名 | 说明                        |
| ------------------- | --------------------------------------------------- | ----- | ---- | --- | ------------------------- |
| cacheConfig         | [CacheConfig](#schemacacheconfig)                   | false | none |     | none                      |
| certificateId       | string                                              | false | none |     | none                      |
| forceRedirect       | [ForceRedirect](#schemaforceredirect)               | false | none |     | none                      |
| httpResponseHeader  | [[HttpResponseHeader](#schemahttpresponseheader)]   | false | none |     | 自定义响应头                    |
| https               | [HttpsInfo](#schemahttpsinfo)                       | false | none |     | none                      |
| ipFilter            | [IpFilter](#schemaipfilter)                         | false | none |     | none                      |
| originProtocol      | string                                              | false | none |     | 回原协议，取值：follow/http/https |
| originRequestHeader | [[OriginRequestHeader](#schemaoriginrequestheader)] | false | none |     | 回原请求头                     |
| rangeStatus         | string                                              | false | none |     | range 开关                  |
| referer             | [Referer](#schemareferer)                           | false | none |     | none                      |
| sources             | [[ConfigSources](#schemaconfigsources)]             | false | none |     | 回原配置                      |
| urlAuth             | [UrlAuth](#schemaurlauth)                           | false | none |     | none                      |

#### 枚举值

| 属性          | 值   |
| ----------- | --- |
| rangeStatus | off |
| rangeStatus | on  |

<h2 id="tocS_ConfigSourcesCommand">ConfigSourcesCommand</h2>

<a id="schemaconfigsourcescommand"></a>
<a id="schema_ConfigSourcesCommand"></a>
<a id="tocSconfigsourcescommand"></a>
<a id="tocsconfigsourcescommand"></a>

```json
{
  "hostName": "string",
  "httpPort": 0,
  "httpsPort": 0,
  "ipOrDomain": "string",
  "originType": "domain"
}
```

ConfigSourcesCommand

### 属性

| 名称         | 类型             | 必选    | 约束   | 中文名 | 说明                      |
| ---------- | -------------- | ----- | ---- | --- | ----------------------- |
| hostName   | string         | true  | none |     | 回原host                  |
| httpPort   | integer(int32) | false | none |     | http 端口                 |
| httpsPort  | integer(int32) | false | none |     | none                    |
| ipOrDomain | string         | true  | none |     | 回原ip或回原域名               |
| originType | string         | true  | none |     | 加速域名回原地址类型ipaddr/domain |

#### 枚举值

| 属性         | 值      |
| ---------- | ------ |
| originType | domain |
| originType | ipaddr |

<h2 id="tocS_ConfigSources">ConfigSources</h2>

<a id="schemaconfigsources"></a>
<a id="schema_ConfigSources"></a>
<a id="tocSconfigsources"></a>
<a id="tocsconfigsources"></a>

```json
{
  "hostName": "string",
  "httpPort": 80,
  "httpsPort": 443,
  "ipOrDomain": "string",
  "originType": "ipaddr/domain"
}
```

ConfigSources

### 属性

| 名称         | 类型             | 必选    | 约束   | 中文名 | 说明                      |
| ---------- | -------------- | ----- | ---- | --- | ----------------------- |
| hostName   | string         | false | none |     | 回原host                  |
| httpPort   | integer(int32) | false | none |     | http 端口                 |
| httpsPort  | integer(int32) | false | none |     | https 端口                |
| ipOrDomain | string         | false | none |     | 回原ip或回原域名               |
| originType | string         | false | none |     | 加速域名回原地址类型ipaddr/domain |

#### 枚举值

| 属性         | 值      |
| ---------- | ------ |
| originType | domain |
| originType | ipaddr |

<h2 id="tocS_CacheConfig">CacheConfig</h2>

<a id="schemacacheconfig"></a>
<a id="schema_CacheConfig"></a>
<a id="tocScacheconfig"></a>
<a id="tocscacheconfig"></a>

```json
{
  "compress": 0,
  "followOrigin": true,
  "ignoreUrlParameter": true,
  "rules": [
    {
      "content": "string",
      "priority": 0,
      "ruleType": 0,
      "ttl": 0,
      "ttlType": 0
    }
  ]
}
```

CacheConfig

### 属性

| 名称                 | 类型                                                    | 必选    | 约束   | 中文名 | 说明        |
| ------------------ | ----------------------------------------------------- | ----- | ---- | --- | --------- |
| compress           | integer(int32)                                        | false | none |     | 是否开启压缩    |
| followOrigin       | boolean                                               | false | none |     | 是否跟随源站    |
| ignoreUrlParameter | boolean                                               | false | none |     | 是否忽略url参数 |
| rules              | [[缓存规则](#schema%e7%bc%93%e5%ad%98%e8%a7%84%e5%88%99)] | false | none |     | 缓存规则      |
