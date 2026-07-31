use serde_json::Value;

const SCHEMAS: &[(&str, &str)] = &[
    (
        "studio",
        include_str!("../../schemas/jl-mixing-v1.2.0/studio.schema.json"),
    ),
    (
        "client",
        include_str!("../../schemas/jl-mixing-v1.2.0/client.schema.json"),
    ),
    (
        "project",
        include_str!("../../schemas/jl-mixing-v1.2.0/project-manifest.schema.json"),
    ),
    (
        "delivery",
        include_str!("../../schemas/jl-mixing-v1.2.0/delivery-manifest.schema.json"),
    ),
];

#[test]
fn bundled_metadata_schemas_accept_release_candidate_provenance() {
    for (name, schema_json) in SCHEMAS {
        let schema: Value = serde_json::from_str(schema_json).expect("valid bundled schema");
        let created_with_schema = schema
            .pointer("/properties/metadata/properties/created_with")
            .unwrap_or_else(|| panic!("{name} schema has created_with contract"));
        let validator = jsonschema::draft202012::options()
            .build(created_with_schema)
            .unwrap_or_else(|_| panic!("{name} created_with schema compiles"));

        assert!(
            validator.is_valid(&Value::String("jl-mixing 1.1.0".into())),
            "{name} must retain stable release provenance compatibility"
        );
        assert!(
            validator.is_valid(&Value::String("jl-mixing 1.4.0-rc.1".into())),
            "{name} must accept the coordinated Automation v1.4 RC provenance"
        );
        assert!(
            validator.is_valid(&Value::String("jl-mixing 1.4.0+build.7".into())),
            "{name} must accept SemVer build metadata"
        );
        assert!(
            !validator.is_valid(&Value::String("jl-mixing 1.4".into())),
            "{name} must still reject malformed application provenance"
        );
    }
}
