#import <React/RCTBridgeModule.h>

@interface RuntimeConfig : NSObject <RCTBridgeModule>
@end

@implementation RuntimeConfig

RCT_EXPORT_MODULE(RuntimeConfig)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (NSDictionary *)constantsToExport
{
  NSDictionary *configured = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"LycorisRuntimeConfig"];
  NSMutableDictionary *values = [NSMutableDictionary new];
  for (NSString *key in @[@"LY_API_BASE_URL", @"LY_THUNDERFOREST_API_KEY", @"LY_TIANDITU_API_KEY"]) {
    id value = [configured isKindOfClass:[NSDictionary class]] ? configured[key] : nil;
    values[key] = [value isKindOfClass:[NSString class]] ? value : @"";
  }
  return values;
}

RCT_EXPORT_METHOD(getRuntimeConfig:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  resolve([self constantsToExport]);
}

@end
