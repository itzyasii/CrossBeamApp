Pod::Spec.new do |s|
  s.name           = 'CrossBeamNative'
  s.version        = '0.1.0'
  s.summary        = 'Native peer discovery and transfer bridge for CrossBeam'
  s.description    = 'Native Android/iOS bridge for local peer discovery and transfer capabilities.'
  s.author         = 'CrossBeam'
  s.homepage       = 'https://example.invalid/crossbeam'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
end

