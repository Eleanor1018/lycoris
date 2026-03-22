#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(NativeLocation, NSObject)

RCT_EXTERN_METHOD(getCurrentPosition:(NSDictionary *)options
                  withResolver:(RCTPromiseResolveBlock)resolve
                  withRejecter:(RCTPromiseRejectBlock)reject)

@end
